import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { dateGroupLabel } from '../dates';
import { STARRED } from '../store';
import { useTheme } from '../theme';
import TaskRow from '../components/TaskRow';
import NewTaskSheet from '../components/NewTaskSheet';
import { ConfirmDialog, OptionSheet, PromptDialog } from '../components/Overlays';

const SORT_OPTIONS = [
  { value: 'my', label: 'My order' },
  { value: 'date', label: 'Date' },
  { value: 'starred', label: 'Starred recently' },
];

const byOrder = (a, b) => a.order - b.order;

// Turns the stored tasks into the rows shown for the selected tab
function buildRows(state, list) {
  const rows = [];
  let completed;

  if (!list) {
    const listName = (id) => state.lists.find((l) => l.id === id)?.title;
    state.tasks
      .filter((t) => t.starred && !t.done)
      .sort((a, b) => b.starredAt - a.starredAt)
      .forEach((t) => rows.push({ key: t.id, task: t, subtitle: listName(t.listId) }));
    completed = state.tasks.filter((t) => t.starred && t.done);
  } else {
    const inList = state.tasks.filter((t) => t.listId === list.id);
    const top = inList.filter((t) => !t.parentId && !t.done);
    const pushWithSubtasks = (t) => {
      rows.push({ key: t.id, task: t });
      inList
        .filter((s) => s.parentId === t.id && !s.done)
        .sort(byOrder)
        .forEach((s) => rows.push({ key: s.id, task: s, indent: true }));
    };

    if (list.sort === 'date') {
      let lastGroup = null;
      top
        .sort(
          (a, b) =>
            (a.due ? 0 : 1) - (b.due ? 0 : 1) ||
            (a.due ?? '').localeCompare(b.due ?? '') ||
            (a.time ?? '99').localeCompare(b.time ?? '99') ||
            byOrder(a, b)
        )
        .forEach((t) => {
          const group = dateGroupLabel(t.due);
          if (group !== lastGroup) {
            rows.push({ key: `group-${group}`, header: group, past: group === 'Past' });
            lastGroup = group;
          }
          pushWithSubtasks(t);
        });
    } else if (list.sort === 'starred') {
      top.sort((a, b) => (b.starred ? b.starredAt : 0) - (a.starred ? a.starredAt : 0) || byOrder(a, b));
      top.forEach(pushWithSubtasks);
    } else {
      top.sort(byOrder).forEach(pushWithSubtasks);
    }
    completed = inList.filter((t) => t.done);
  }

  completed.sort((a, b) => b.completedAt - a.completedAt);
  return { rows, completed };
}

function EmptyState({ starredView, allDone }) {
  const theme = useTheme();
  let icon = 'playlist-add';
  let title = 'No tasks yet';
  let body = 'Add your to-dos and keep track of them here.';
  if (starredView) {
    icon = 'star-border';
    title = 'No starred tasks';
    body = 'Mark important tasks with a star so you can easily find them here.';
  } else if (allDone) {
    icon = 'check-circle';
    title = 'All tasks complete';
    body = 'Nice work!';
  }
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primaryContainer }]}>
        <MaterialIcons name={icon} size={48} color={theme.onPrimaryContainer} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

export default function Home({ state, dispatch, loaded, actions, onOpenTask }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState(null); // 'new' | 'rename'
  const [confirm, setConfirm] = useState(null); // 'deleteList' | 'clearCompleted'
  const [showCompleted, setShowCompleted] = useState(false);

  const starredView = state.selected === STARRED;
  const list = starredView ? null : state.lists.find((l) => l.id === state.selected);
  const { rows, completed } = useMemo(() => buildRows(state, list), [state, list]);

  const data = [...rows];
  if (completed.length) {
    data.push({ key: 'completed-header', completedHeader: true });
    if (showCompleted) completed.forEach((t) => data.push({ key: t.id, task: t }));
  }

  const addTask = (fields) =>
    dispatch({ type: 'ADD_TASK', task: { ...fields, listId: list ? list.id : state.lists[0].id } });

  const listMenu = list
    ? [
        { header: 'Sort by' },
        ...SORT_OPTIONS.map((o) => ({
          label: o.label,
          checked: list.sort === o.value,
          onPress: () => dispatch({ type: 'SET_SORT', id: list.id, sort: o.value }),
        })),
        { header: 'List' },
        { label: 'Rename list', icon: 'edit', onPress: () => setPrompt('rename') },
        {
          label: 'Delete list',
          icon: 'delete-outline',
          disabled: state.lists.length <= 1,
          hint: state.lists.length <= 1 ? "Your only list can't be deleted" : undefined,
          onPress: () => setConfirm('deleteList'),
        },
        {
          label: 'Delete all completed tasks',
          icon: 'check-circle',
          disabled: !completed.length,
          onPress: () => setConfirm('clearCompleted'),
        },
      ]
    : [];

  const renderItem = ({ item }) => {
    if (item.header) {
      return (
        <Text style={[styles.groupHeader, { color: item.past ? theme.danger : theme.textSecondary }]}>
          {item.header}
        </Text>
      );
    }
    if (item.completedHeader) {
      return (
        <Pressable
          onPress={() => setShowCompleted(!showCompleted)}
          style={[styles.completedHeader, { borderTopColor: theme.divider }]}
        >
          <Text style={[styles.completedLabel, { color: theme.text }]}>Completed ({completed.length})</Text>
          <MaterialIcons name={showCompleted ? 'expand-less' : 'expand-more'} size={24} color={theme.textSecondary} />
        </Pressable>
      );
    }
    return (
      <TaskRow
        task={item.task}
        indent={item.indent}
        subtitle={item.subtitle}
        onPress={() => onOpenTask(item.task.id)}
        onToggle={() => actions.toggleDone(item.task)}
        onStar={() => actions.toggleStar(item.task)}
      />
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
      <Text style={[styles.appTitle, { color: theme.text }]}>Anjali's World</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsScroll, { borderBottomColor: theme.divider }]}
        contentContainerStyle={styles.tabs}
      >
        <Tab selected={starredView} onPress={() => dispatch({ type: 'SELECT', id: STARRED })} label="Starred">
          <MaterialIcons name={starredView ? 'star' : 'star-border'} size={22} color={starredView ? theme.primary : theme.textSecondary} />
        </Tab>
        {state.lists.map((l) => (
          <Tab key={l.id} selected={l.id === state.selected} onPress={() => dispatch({ type: 'SELECT', id: l.id })} label={l.title} />
        ))}
        <Tab onPress={() => setPrompt('new')} label="New list">
          <View style={styles.newListTab}>
            <MaterialIcons name="add" size={20} color={theme.textSecondary} />
            <Text style={[styles.tabLabel, { color: theme.textSecondary }]}>New list</Text>
          </View>
        </Tab>
      </ScrollView>

      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>
            {list ? list.title : 'Starred tasks'}
          </Text>
          {list && (
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.menuBtn} accessibilityLabel="List options">
              <MaterialIcons name="more-vert" size={24} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {loaded && !rows.length && <EmptyState starredView={starredView} allDone={completed.length > 0} />}

        <FlatList
          data={data}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          style={rows.length ? styles.list : styles.listCollapsed}
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        />
      </View>

      <Pressable
        onPress={() => setAdding(true)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.fab, bottom: insets.bottom + 20, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityLabel="Add a task"
      >
        <MaterialIcons name="add" size={30} color={theme.fabIcon} />
      </Pressable>

      {adding && <NewTaskSheet startStarred={starredView} onSave={addTask} onClose={() => setAdding(false)} />}
      {menuOpen && <OptionSheet options={listMenu} onClose={() => setMenuOpen(false)} />}
      {prompt === 'new' && (
        <PromptDialog
          title="Create new list"
          placeholder="Enter name"
          onConfirm={(title) => dispatch({ type: 'ADD_LIST', title })}
          onClose={() => setPrompt(null)}
        />
      )}
      {prompt === 'rename' && list && (
        <PromptDialog
          title="Rename list"
          initial={list.title}
          onConfirm={(title) => dispatch({ type: 'RENAME_LIST', id: list.id, title })}
          onClose={() => setPrompt(null)}
        />
      )}
      {confirm === 'deleteList' && list && (
        <ConfirmDialog
          title="Delete this list?"
          message={`"${list.title}" and all of its tasks will be permanently deleted.`}
          confirmLabel="Delete"
          onConfirm={() => dispatch({ type: 'DELETE_LIST', id: list.id })}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'clearCompleted' && list && (
        <ConfirmDialog
          title="Delete all completed tasks?"
          message={`${completed.length} completed ${completed.length === 1 ? 'task' : 'tasks'} will be permanently deleted from this list.`}
          confirmLabel="Delete"
          onConfirm={() => dispatch({ type: 'CLEAR_COMPLETED', id: list.id })}
          onClose={() => setConfirm(null)}
        />
      )}
    </View>
  );
}

function Tab({ selected, onPress, label, children }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={label}>
      {children ?? (
        <Text style={[styles.tabLabel, { color: selected ? theme.primary : theme.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      )}
      <View style={[styles.tabIndicator, selected && { backgroundColor: theme.primary }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  appTitle: { fontSize: 22, fontWeight: '500', textAlign: 'center', paddingVertical: 14 },
  tabsScroll: { flexGrow: 0, borderBottomWidth: 1 },
  tabs: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingTop: 10, justifyContent: 'flex-end', alignItems: 'center', maxWidth: 200 },
  tabLabel: { fontSize: 14, fontWeight: '600', paddingBottom: 10 },
  tabIndicator: { height: 3, alignSelf: 'stretch', borderTopLeftRadius: 3, borderTopRightRadius: 3, marginTop: 'auto' },
  newListTab: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: { flex: 1, marginTop: 12, marginHorizontal: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  listHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, paddingTop: 16, paddingBottom: 4 },
  listTitle: { flex: 1, fontSize: 22 },
  menuBtn: { padding: 8 },
  list: { flex: 1 },
  listCollapsed: { flexGrow: 0 },
  groupHeader: { fontSize: 14, fontWeight: '600', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    marginTop: 8,
  },
  completedLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  empty: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 48, paddingBottom: 24 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, marginBottom: 8 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
