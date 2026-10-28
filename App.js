import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@todos_v1';
const FILTERS = ['All', 'Active', 'Done'];

export default function App() {
  return (
    <SafeAreaProvider>
      <TodoScreen />
    </SafeAreaProvider>
  );
}

function TodoScreen() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('All');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Load saved todos from phone storage on startup
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        if (json) setTodos(JSON.parse(json));
      })
      .catch(() => Alert.alert('Error', 'Could not load your tasks.'))
      .finally(() => setLoaded(true));
  }, []);

  // Save to phone storage whenever the list changes
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(todos)).catch(() =>
      Alert.alert('Error', 'Could not save your tasks.')
    );
  }, [todos, loaded]);

  const addTodo = () => {
    const title = text.trim();
    if (!title) return;
    setTodos((prev) => [
      { id: Date.now().toString(), title, done: false, createdAt: Date.now() },
      ...prev,
    ]);
    setText('');
  };

  const toggleTodo = (id) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  // First tap on ✕ asks "Delete?", second tap deletes
  const deleteTodo = (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setTodos((prev) => prev.filter((t) => t.id !== id));
    setConfirmDeleteId(null);
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditText(todo.title);
  };

  const saveEdit = () => {
    const title = editText.trim();
    if (title) {
      setTodos((prev) => prev.map((t) => (t.id === editingId ? { ...t, title } : t)));
    }
    setEditingId(null);
  };

  const clearDone = () => setTodos((prev) => prev.filter((t) => !t.done));

  const visible = todos.filter((t) =>
    filter === 'Active' ? !t.done : filter === 'Done' ? t.done : true
  );
  const remaining = todos.filter((t) => !t.done).length;

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Pressable onPress={() => toggleTodo(item.id)} hitSlop={10}>
        <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
          {item.done && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </Pressable>

      {editingId === item.id ? (
        <TextInput
          style={[styles.itemText, styles.editInput]}
          value={editText}
          onChangeText={setEditText}
          onSubmitEditing={saveEdit}
          onBlur={saveEdit}
          autoFocus
          returnKeyType="done"
        />
      ) : (
        <Pressable style={{ flex: 1 }} onLongPress={() => startEdit(item)}>
          <Text style={[styles.itemText, item.done && styles.itemTextDone]}>
            {item.title}
          </Text>
        </Pressable>
      )}

      {confirmDeleteId === item.id ? (
        <View style={styles.confirmRow}>
          <Pressable onPress={() => setConfirmDeleteId(null)} hitSlop={6}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.confirmBtn} onPress={() => deleteTodo(item.id)}>
            <Text style={styles.confirmText}>Delete?</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => deleteTodo(item.id)} hitSlop={10}>
          <Text style={styles.delete}>✕</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.header}>My To-Do List</Text>
        <Text style={styles.subheader}>
          {remaining} {remaining === 1 ? 'task' : 'tasks'} left
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a new task..."
            value={text}
            onChangeText={setText}
            onSubmitEditing={addTodo}
            returnKeyType="done"
          />
          <Pressable style={styles.addButton} onPress={addTodo}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loaded && <Text style={styles.empty}>Nothing here yet 🎉</Text>
          }
        />

        {todos.some((t) => t.done) && (
          <Pressable style={styles.clearBtn} onPress={clearDone}>
            <Text style={styles.clearText}>Clear completed</Text>
          </Pressable>
        )}

        <Text style={styles.hint}>Tip: long-press a task to edit it</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ACCENT = '#4F46E5';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA', paddingHorizontal: 16 },
  header: { fontSize: 32, fontWeight: '700', color: '#111827', marginTop: 12 },
  subheader: { fontSize: 15, color: '#6B7280', marginBottom: 16 },
  inputRow: { flexDirection: 'row', marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addButton: {
    marginLeft: 8,
    width: 48,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 28, lineHeight: 30 },
  filters: { flexDirection: 'row', marginBottom: 12 },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#E5E7EB',
  },
  filterBtnActive: { backgroundColor: ACCENT },
  filterText: { color: '#374151', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEF0F4',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ACCENT,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: ACCENT },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  itemText: { fontSize: 16, color: '#111827' },
  itemTextDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  editInput: { flex: 1, padding: 0, borderBottomWidth: 1, borderColor: ACCENT },
  delete: { fontSize: 18, color: '#EF4444', marginLeft: 12 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  cancelText: { color: '#6B7280', fontWeight: '500', marginRight: 10 },
  confirmBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  confirmText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 16 },
  clearBtn: { alignSelf: 'center', padding: 10 },
  clearText: { color: '#EF4444', fontWeight: '600' },
  hint: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginBottom: 8 },
});
