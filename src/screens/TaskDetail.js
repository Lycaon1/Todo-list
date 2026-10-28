import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDue, formatRepeat, isOverdue } from '../dates';
import { uid } from '../store';
import { noOutline, useTheme } from '../theme';
import { Checkbox } from '../components/TaskRow';
import DatePickerDialog from '../components/DatePicker';
import { OptionSheet } from '../components/Overlays';

function SubtaskRow({ task, autoFocus, onChange, onToggle, onDelete }) {
  const theme = useTheme();
  const [title, setTitle] = useState(task.title);
  return (
    <View style={styles.subtask}>
      <Checkbox done={task.done} onPress={onToggle} size={20} />
      <TextInput
        value={title}
        onChangeText={(text) => {
          setTitle(text);
          onChange(text);
        }}
        onBlur={() => !title.trim() && onDelete()}
        placeholder="Enter title"
        placeholderTextColor={theme.muted}
        autoFocus={autoFocus}
        style={[
          styles.subtaskInput,
          { color: task.done ? theme.muted : theme.text },
          task.done && { textDecorationLine: 'line-through' },
          noOutline,
        ]}
      />
      <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="Delete subtask">
        <MaterialIcons name="close" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

export default function TaskDetail({ task, state, dispatch, actions, onBack }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [picking, setPicking] = useState(false);
  const [choosingList, setChoosingList] = useState(false);
  const [newSubtaskId, setNewSubtaskId] = useState(null);

  const list = state.lists.find((l) => l.id === task.listId);
  const subtasks = state.tasks.filter((t) => t.parentId === task.id).sort((a, b) => a.order - b.order);
  const update = (changes) => dispatch({ type: 'UPDATE_TASK', id: task.id, changes });
  const overdue = !!task.due && !task.done && isOverdue(task.due, task.time);

  const addSubtask = () => {
    const id = uid();
    dispatch({ type: 'ADD_TASK', task: { id, listId: task.listId, parentId: task.id, title: '' } });
    setNewSubtaskId(id);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Back">
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.spacer} />
        <Pressable onPress={() => actions.toggleStar(task)} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Star">
          <MaterialIcons
            name={task.starred ? 'star' : 'star-border'}
            size={24}
            color={task.starred ? theme.primary : theme.text}
          />
        </Pressable>
        <Pressable
          onPress={() => {
            onBack();
            actions.deleteTask(task);
          }}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel="Delete task"
        >
          <MaterialIcons name="delete-outline" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!task.parentId && (
          <Pressable onPress={() => setChoosingList(true)} style={styles.listPicker}>
            <Text style={[styles.listName, { color: theme.primary }]}>{list?.title}</Text>
            <MaterialIcons name="arrow-drop-down" size={22} color={theme.primary} />
          </Pressable>
        )}

        <TextInput
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            update({ title: text });
          }}
          onBlur={() => !title.trim() && setTitle(task.title)}
          placeholder="Enter title"
          placeholderTextColor={theme.muted}
          multiline
          style={[
            styles.title,
            { color: theme.text },
            task.done && { textDecorationLine: 'line-through', color: theme.muted },
            noOutline,
          ]}
        />

        <View style={styles.field}>
          <MaterialIcons name="notes" size={24} color={theme.textSecondary} style={styles.fieldIcon} />
          <TextInput
            value={notes}
            onChangeText={(text) => {
              setNotes(text);
              update({ notes: text });
            }}
            placeholder="Add details"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.fieldInput, { color: theme.text }, noOutline]}
          />
        </View>

        <View style={styles.field}>
          <MaterialIcons name="event" size={24} color={theme.textSecondary} style={styles.fieldIcon} />
          {task.due ? (
            <View style={[styles.chip, { borderColor: overdue ? theme.danger : theme.outline }]}>
              <Pressable onPress={() => setPicking(true)}>
                <Text style={{ color: overdue ? theme.danger : theme.text, fontSize: 14 }}>
                  {formatDue(task.due, task.time)}
                </Text>
              </Pressable>
              <Pressable onPress={() => update({ due: null })} hitSlop={8} accessibilityLabel="Remove date">
                <MaterialIcons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setPicking(true)} style={styles.fieldPress}>
              <Text style={[styles.fieldText, { color: theme.textSecondary }]}>Add date/time</Text>
            </Pressable>
          )}
        </View>

        {!!task.repeat && (
          <Pressable style={styles.field} onPress={() => setPicking(true)}>
            <MaterialIcons name="repeat" size={24} color={theme.textSecondary} style={styles.fieldIcon} />
            <Text style={[styles.fieldText, { color: theme.text }]}>{formatRepeat(task.repeat)}</Text>
          </Pressable>
        )}

        {!task.parentId && (
          <>
            <Pressable style={styles.field} onPress={addSubtask}>
              <MaterialIcons
                name="subdirectory-arrow-right"
                size={24}
                color={theme.textSecondary}
                style={styles.fieldIcon}
              />
              <Text style={[styles.fieldText, { color: theme.textSecondary }]}>Add subtasks</Text>
            </Pressable>
            {subtasks.map((s) => (
              <SubtaskRow
                key={s.id}
                task={s}
                autoFocus={s.id === newSubtaskId}
                onChange={(text) => dispatch({ type: 'UPDATE_TASK', id: s.id, changes: { title: text } })}
                onToggle={() => dispatch({ type: 'TOGGLE_DONE', id: s.id })}
                onDelete={() => dispatch({ type: 'DELETE_TASK', id: s.id })}
              />
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, borderTopColor: theme.divider }]}>
        <Pressable
          onPress={() => {
            if (!task.done) onBack();
            actions.toggleDone(task);
          }}
          style={({ pressed }) => [styles.completeBtn, pressed && { backgroundColor: theme.pressed }]}
        >
          <Text style={[styles.completeText, { color: theme.primary }]}>
            {task.done ? 'Mark uncompleted' : 'Mark completed'}
          </Text>
        </Pressable>
      </View>

      {picking && (
        <DatePickerDialog
          due={task.due}
          time={task.time}
          repeat={task.repeat}
          onDone={update}
          onClose={() => setPicking(false)}
        />
      )}
      {choosingList && (
        <OptionSheet
          options={[
            { header: 'Move to list' },
            ...state.lists.map((l) => ({
              label: l.title,
              checked: l.id === task.listId,
              onPress: () => l.id !== task.listId && dispatch({ type: 'MOVE_TASK', id: task.id, listId: l.id }),
            })),
          ]}
          onClose={() => setChoosingList(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  iconBtn: { padding: 12 },
  spacer: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  listPicker: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 4 },
  listName: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 24, paddingVertical: 8, marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  fieldIcon: { width: 40 },
  fieldInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  fieldPress: { flex: 1, paddingVertical: 12 },
  fieldText: { flex: 1, fontSize: 15 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subtask: { flexDirection: 'row', alignItems: 'center', paddingLeft: 40, minHeight: 44 },
  subtaskInput: { flex: 1, fontSize: 15, paddingVertical: 8, marginRight: 8 },
  bottomBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  completeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  completeText: { fontSize: 14, fontWeight: '600' },
});
