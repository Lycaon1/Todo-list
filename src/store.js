import { useEffect, useReducer, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nextRepeatDate } from './dates';

const STORAGE_KEY = '@tasks_v2';
const LEGACY_KEY = '@todos_v1';
export const STARRED = 'starred';

let counter = 0;
export const uid = () =>
  `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function defaultState() {
  const id = uid();
  return { lists: [{ id, title: 'My Tasks', sort: 'my' }], tasks: [], selected: id };
}

// Converts tasks saved by the first version of the app
function migrateLegacy(todos) {
  const state = defaultState();
  const listId = state.lists[0].id;
  state.tasks = todos.map((t, i) => newTask({
    id: t.id,
    listId,
    title: t.title,
    done: t.done,
    completedAt: t.done ? Date.now() : null,
    createdAt: t.createdAt ?? Date.now(),
    order: i,
  }));
  return state;
}

function newTask(fields) {
  return {
    id: uid(),
    listId: null,
    parentId: null,
    title: '',
    notes: '',
    due: null,
    time: null,
    repeat: null,
    starred: false,
    starredAt: null,
    done: false,
    completedAt: null,
    createdAt: Date.now(),
    order: 0,
    ...fields,
  };
}

function withChanges(task, changes) {
  const next = { ...task, ...changes };
  if ('starred' in changes) next.starredAt = changes.starred ? Date.now() : null;
  if ('due' in changes && !changes.due) {
    next.time = null;
    next.repeat = null;
  }
  return next;
}

function toggleDone(state, id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  const now = Date.now();

  if (!task.done) {
    // Completing a task also completes its subtasks
    let tasks = state.tasks.map((t) =>
      t.id === id || (t.parentId === id && !t.done) ? { ...t, done: true, completedAt: now } : t
    );
    if (task.repeat && task.due) {
      tasks = [
        ...tasks,
        { ...task, id: uid(), done: false, completedAt: null, createdAt: now, due: nextRepeatDate(task.due, task.repeat) },
      ];
    }
    return { ...state, tasks };
  }

  // Un-completing a subtask also brings back its parent
  return {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === id || t.id === task.parentId ? { ...t, done: false, completedAt: null } : t
    ),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return action.state;

    case 'SELECT':
      return { ...state, selected: action.id };

    case 'ADD_LIST': {
      const id = uid();
      return { ...state, lists: [...state.lists, { id, title: action.title, sort: 'my' }], selected: id };
    }

    case 'RENAME_LIST':
      return { ...state, lists: state.lists.map((l) => (l.id === action.id ? { ...l, title: action.title } : l)) };

    case 'DELETE_LIST': {
      if (state.lists.length <= 1) return state;
      const lists = state.lists.filter((l) => l.id !== action.id);
      return { ...state, lists, tasks: state.tasks.filter((t) => t.listId !== action.id), selected: lists[0].id };
    }

    case 'SET_SORT':
      return { ...state, lists: state.lists.map((l) => (l.id === action.id ? { ...l, sort: action.sort } : l)) };

    case 'ADD_TASK': {
      const parentId = action.task.parentId ?? null;
      const siblings = state.tasks
        .filter((t) => t.listId === action.task.listId && t.parentId === parentId)
        .map((t) => t.order);
      // New tasks go to the top of the list, new subtasks to the bottom of their parent
      let order = 0;
      if (siblings.length) order = parentId ? Math.max(...siblings) + 1 : Math.min(...siblings) - 1;
      const task = newTask({ ...action.task, parentId, order });
      if (task.starred) task.starredAt = Date.now();
      return { ...state, tasks: [...state.tasks, task] };
    }

    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? withChanges(t, action.changes) : t)) };

    case 'TOGGLE_DONE':
      return toggleDone(state, action.id);

    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id && t.parentId !== action.id) };

    case 'MOVE_TASK': {
      const top = state.tasks.filter((t) => t.listId === action.listId && !t.parentId).map((t) => t.order);
      const order = top.length ? Math.min(...top) - 1 : 0;
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id === action.id) return { ...t, listId: action.listId, parentId: null, order };
          if (t.parentId === action.id) return { ...t, listId: action.listId };
          return t;
        }),
      };
    }

    case 'CLEAR_COMPLETED': {
      const removed = new Set(state.tasks.filter((t) => t.listId === action.id && t.done).map((t) => t.id));
      return { ...state, tasks: state.tasks.filter((t) => !removed.has(t.id) && !removed.has(t.parentId)) };
    }

    case 'PRUNE_EMPTY_SUBTASKS':
      return { ...state, tasks: state.tasks.filter((t) => !t.parentId || t.title.trim()) };

    case 'RESTORE_TASKS':
      return { ...state, tasks: action.tasks };

    default:
      return state;
  }
}

// Returns a usable task state from saved data, or null if it is not task data
export function normalizeTaskState(saved) {
  if (!saved || !Array.isArray(saved.lists) || !saved.lists.length || !Array.isArray(saved.tasks)) return null;
  const selectedExists = saved.selected === STARRED || saved.lists.some((l) => l.id === saved.selected);
  return { ...saved, selected: selectedExists ? saved.selected : saved.lists[0].id };
}

export function useTaskStore() {
  const [state, dispatch] = useReducer(reducer, null, defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          const saved = normalizeTaskState(JSON.parse(json));
          if (saved) dispatch({ type: 'LOAD', state: saved });
        } else {
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (legacy) dispatch({ type: 'LOAD', state: migrateLegacy(JSON.parse(legacy)) });
        }
      } catch {
        // Unreadable data: start with a fresh list
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  return [state, dispatch, loaded];
}
