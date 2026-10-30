import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaInsetsContext, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { uid, useTaskStore } from './src/store';
import { usePropertyStore } from './src/propertyStore';
import { useCalendarStore } from './src/calendarStore';
import { useSettingsStore } from './src/settingsStore';
import { useTheme } from './src/theme';
import Home from './src/screens/Home';
import TaskDetail from './src/screens/TaskDetail';
import More, { backupIsStale, buildReminderForm } from './src/screens/More';
import PropertiesHome from './src/screens/properties/PropertiesHome';
import PropertyDetail from './src/screens/properties/PropertyDetail';
import TenantDetail from './src/screens/properties/TenantDetail';
import Vendors from './src/screens/properties/Vendors';
import { buildForm } from './src/screens/properties/forms';
import CalendarScreen from './src/screens/calendar/CalendarScreen';
import { buildEventForm } from './src/screens/calendar/eventForm';
import FormScreen from './src/components/FormScreen';
import Snackbar from './src/components/Snackbar';
import TabBar from './src/components/TabBar';
import { OverlayCountContext } from './src/components/Overlays';
import { upcomingReminders } from './src/reminders';
import {
  cancelReminders,
  getReminderPermission,
  remindersSupported,
  requestReminderPermission,
  scheduleReminders,
} from './src/notifications';

const TAB_BAR_HEIGHT = 70;
const FORM_COLLECTIONS = {
  property: 'properties',
  tenant: 'tenants',
  payment: 'payments',
  repair: 'repairs',
  expense: 'expenses',
  vendor: 'vendors',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tasks, taskDispatch, tasksLoaded] = useTaskStore();
  const [properties, propertyDispatch] = usePropertyStore();
  const [calendar, calendarDispatch, calendarLoaded] = useCalendarStore();
  const [settings, settingsDispatch, settingsLoaded] = useSettingsStore();
  const [tab, setTab] = useState('tasks');
  const [stack, setStack] = useState([]); // screens opened on top of the tabs: [{ key, name, params }]
  const [overlayCount, setOverlayCount] = useState(0);
  const [snack, setSnack] = useState(null); // { message, undo, tasks }

  const stackRef = useRef(stack);
  stackRef.current = stack;

  const reportOverlay = useCallback((delta) => setOverlayCount((c) => c + delta), []);
  const dismissSnack = useCallback(() => setSnack(null), []);
  const showMessage = useCallback((message) => setSnack({ message }), []);

  const nav = useMemo(
    () => ({
      push: (name, params = {}) => setStack((s) => [...s, { key: uid(), name, params }]),
      pop: () => {
        const top = stackRef.current[stackRef.current.length - 1];
        if (top?.name === 'task') taskDispatch({ type: 'PRUNE_EMPTY_SUBTASKS' });
        setStack((s) => s.slice(0, -1));
      },
    }),
    [taskDispatch]
  );

  // Android back button closes the top screen. Registered once, so open sheets
  // and dialogs (which register later) get the press first.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!stackRef.current.length) return false;
      nav.pop();
      return true;
    });
    return () => sub.remove();
  }, [nav]);

  // Close screens whose record was deleted (e.g. a property deleted from its edit form)
  const routeIsValid = useCallback(
    ({ name, params }) => {
      if (name === 'task') return tasks.tasks.some((t) => t.id === params.id);
      if (name === 'property') return properties.properties.some((p) => p.id === params.id);
      if (name === 'tenant') return properties.tenants.some((t) => t.id === params.id);
      if (name === 'form' && params.id && params.kind === 'event') return calendar.events.some((e) => e.id === params.id);
      if (name === 'form' && params.id) return properties[FORM_COLLECTIONS[params.kind]].some((x) => x.id === params.id);
      return true;
    },
    [tasks, properties, calendar]
  );
  useEffect(() => {
    if (stack.some((r) => !routeIsValid(r))) setStack((s) => s.filter(routeIsValid));
  }, [stack, routeIsValid]);

  // ---- Reminders: keep the phone's scheduled alerts in step with events and tasks ----
  const [reminderStatus, setReminderStatus] = useState({
    permission: remindersSupported ? 'undetermined' : 'unsupported',
    scheduled: 0,
  });
  const [appOpenedAt, setAppOpenedAt] = useState(Date.now());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && setAppOpenedAt(Date.now()));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!remindersSupported || !tasksLoaded || !calendarLoaded || !settingsLoaded) return undefined;
    // Wait for typing to settle before rescheduling
    const timer = setTimeout(async () => {
      try {
        let permission = await getReminderPermission();
        const hasDates = calendar.events.length > 0 || tasks.tasks.some((t) => t.due && !t.done);
        if (permission === 'undetermined' && settings.remindersOn && !settings.askedForReminders && hasDates) {
          settingsDispatch({ type: 'SET', changes: { askedForReminders: true } });
          permission = await requestReminderPermission();
        }
        let scheduled = 0;
        if (!settings.remindersOn) await cancelReminders();
        else if (permission === 'granted') {
          scheduled = await scheduleReminders(
            upcomingReminders({ events: calendar.events, tasks: tasks.tasks, defaults: settings.defaultReminders })
          );
        }
        setReminderStatus({ permission, scheduled });
      } catch {
        // Scheduling failed; it is retried on the next change or app open
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [calendar, tasks, settings, tasksLoaded, calendarLoaded, settingsLoaded, appOpenedAt, settingsDispatch]);

  const turnOnReminders = async () => {
    const permission = await requestReminderPermission();
    settingsDispatch({ type: 'SET', changes: { askedForReminders: true, remindersOn: true } });
    setReminderStatus((s) => ({ ...s, permission }));
  };

  const taskActions = {
    toggleDone: (task) => {
      const before = tasks.tasks;
      taskDispatch({ type: 'TOGGLE_DONE', id: task.id });
      if (!task.done) setSnack({ message: '1 completed', undo: true, tasks: before });
    },
    deleteTask: (task) => {
      const before = tasks.tasks;
      taskDispatch({ type: 'DELETE_TASK', id: task.id });
      setSnack({ message: '1 task deleted', undo: true, tasks: before });
    },
    toggleStar: (task) => taskDispatch({ type: 'UPDATE_TASK', id: task.id, changes: { starred: !task.starred } }),
  };

  const restore = (backup) => {
    taskDispatch({ type: 'LOAD', state: backup.tasks });
    propertyDispatch({ type: 'LOAD', state: backup.properties });
    calendarDispatch({ type: 'LOAD', state: backup.calendar });
    if (backup.settings.currency) settingsDispatch({ type: 'SET', changes: { currency: backup.settings.currency } });
    setStack([]);
  };

  const renderRoute = (route) => {
    const { name, params } = route;
    if (!routeIsValid(route)) return null;
    switch (name) {
      case 'task': {
        const task = tasks.tasks.find((t) => t.id === params.id);
        return <TaskDetail task={task} state={tasks} dispatch={taskDispatch} actions={taskActions} onBack={nav.pop} />;
      }
      case 'property':
        return <PropertyDetail id={params.id} data={properties} settings={settings} nav={nav} />;
      case 'tenant':
        return <TenantDetail id={params.id} data={properties} settings={settings} nav={nav} />;
      case 'vendors':
        return <Vendors data={properties} nav={nav} />;
      case 'form': {
        let form;
        if (params.kind === 'event') form = buildEventForm(params, { calendar, dispatch: calendarDispatch, settings });
        else if (params.kind === 'reminders') form = buildReminderForm(settings, settingsDispatch);
        else form = buildForm(params, { data: properties, dispatch: propertyDispatch, settings });
        return form && <FormScreen {...form} onClose={nav.pop} />;
      }
      default:
        return null;
    }
  };

  const hasData = tasks.tasks.length > 0 || properties.properties.length > 0 || calendar.events.length > 0;
  const tabs = [
    { key: 'tasks', label: 'Tasks', icon: 'task-alt' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-month' },
    { key: 'properties', label: 'Properties', icon: 'apartment' },
    { key: 'more', label: 'More', icon: 'more-horiz', badge: hasData && backupIsStale(settings) },
  ];
  const tabBarVisible = overlayCount === 0 && stack.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <OverlayCountContext.Provider value={reportOverlay}>
        {/* The tab bar covers the bottom safe area, so tab screens don't add it again */}
        <SafeAreaInsetsContext.Provider value={tabBarVisible ? { ...insets, bottom: 0 } : insets}>
          <View style={styles.root}>
            <View style={[styles.root, tab !== 'tasks' && styles.hidden]}>
              <Home
                state={tasks}
                dispatch={taskDispatch}
                loaded={tasksLoaded}
                actions={taskActions}
                onOpenTask={(id) => nav.push('task', { id })}
              />
            </View>
            <View style={[styles.root, tab !== 'calendar' && styles.hidden]}>
              <CalendarScreen
                calendar={calendar}
                calendarDispatch={calendarDispatch}
                tasks={tasks}
                properties={properties}
                settings={settings}
                settingsDispatch={settingsDispatch}
                appOpenedAt={appOpenedAt}
                nav={nav}
                showMessage={showMessage}
              />
            </View>
            <View style={[styles.root, tab !== 'properties' && styles.hidden]}>
              <PropertiesHome data={properties} settings={settings} nav={nav} />
            </View>
            <View style={[styles.root, tab !== 'more' && styles.hidden]}>
              <More
                tasks={tasks}
                properties={properties}
                calendar={calendar}
                settings={settings}
                settingsDispatch={settingsDispatch}
                onRestore={restore}
                showMessage={showMessage}
                reminderStatus={reminderStatus}
                onTurnOnReminders={turnOnReminders}
                nav={nav}
              />
            </View>
          </View>
        </SafeAreaInsetsContext.Provider>
        {tabBarVisible && <TabBar tabs={tabs} current={tab} onChange={setTab} />}
        {stack.map((route) => (
          <View key={route.key} style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>
            {renderRoute(route)}
          </View>
        ))}
      </OverlayCountContext.Provider>
      <Snackbar
        snack={snack}
        bottomOffset={tabBarVisible ? TAB_BAR_HEIGHT : 0}
        onDismiss={dismissSnack}
        onUndo={() => {
          taskDispatch({ type: 'RESTORE_TASKS', tasks: snack.tasks });
          setSnack(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
});
