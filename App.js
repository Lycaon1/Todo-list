import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTaskStore } from './src/store';
import { useTheme } from './src/theme';
import Home from './src/screens/Home';
import TaskDetail from './src/screens/TaskDetail';
import Snackbar from './src/components/Snackbar';

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const theme = useTheme();
  const [state, dispatch, loaded] = useTaskStore();
  const [openTaskId, setOpenTaskId] = useState(null);
  const [snack, setSnack] = useState(null); // { message, tasks } - tasks is the snapshot Undo restores

  const openTask = state.tasks.find((t) => t.id === openTaskId);
  const closeTask = useCallback(() => {
    dispatch({ type: 'PRUNE_EMPTY_SUBTASKS' });
    setOpenTaskId(null);
  }, [dispatch]);
  const dismissSnack = useCallback(() => setSnack(null), []);

  // Android back button leaves the task screen instead of the app
  useEffect(() => {
    if (!openTask || Platform.OS === 'web') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeTask();
      return true;
    });
    return () => sub.remove();
  }, [openTask, closeTask]);

  const actions = {
    toggleDone: (task) => {
      const before = state.tasks;
      dispatch({ type: 'TOGGLE_DONE', id: task.id });
      if (!task.done) setSnack({ message: '1 completed', tasks: before });
    },
    deleteTask: (task) => {
      const before = state.tasks;
      dispatch({ type: 'DELETE_TASK', id: task.id });
      setSnack({ message: '1 task deleted', tasks: before });
    },
    toggleStar: (task) => dispatch({ type: 'UPDATE_TASK', id: task.id, changes: { starred: !task.starred } }),
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {openTask ? (
        <TaskDetail
          key={openTask.id}
          task={openTask}
          state={state}
          dispatch={dispatch}
          actions={actions}
          onBack={closeTask}
        />
      ) : (
        <Home state={state} dispatch={dispatch} loaded={loaded} actions={actions} onOpenTask={setOpenTaskId} />
      )}
      <Snackbar
        snack={snack}
        onDismiss={dismissSnack}
        onUndo={() => {
          dispatch({ type: 'RESTORE_TASKS', tasks: snack.tasks });
          setSnack(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
