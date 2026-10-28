import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDue } from '../dates';
import { noOutline, useTheme } from '../theme';
import { BottomSheet, TextButton } from './Overlays';
import DatePickerDialog from './DatePicker';

export default function NewTaskSheet({ startStarred, onSave, onClose }) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [starred, setStarred] = useState(startStarred);
  const [date, setDate] = useState({ due: null, time: null, repeat: null });
  const [picking, setPicking] = useState(false);

  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), notes: notes.trim(), starred, ...date });
    onClose();
  };

  return (
    <>
      <BottomSheet onClose={onClose}>
        <View style={styles.body}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="New task"
            placeholderTextColor={theme.muted}
            autoFocus
            onSubmitEditing={save}
            returnKeyType="done"
            style={[styles.title, { color: theme.text }, noOutline]}
          />
          {showNotes && (
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add details"
              placeholderTextColor={theme.muted}
              autoFocus
              multiline
              style={[styles.notes, { color: theme.text }, noOutline]}
            />
          )}
          {!!date.due && (
            <View style={[styles.chip, { borderColor: theme.outline }]}>
              <Pressable onPress={() => setPicking(true)}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{formatDue(date.due, date.time)}</Text>
              </Pressable>
              {!!date.repeat && <MaterialIcons name="repeat" size={14} color={theme.textSecondary} />}
              <Pressable
                onPress={() => setDate({ due: null, time: null, repeat: null })}
                hitSlop={8}
                accessibilityLabel="Remove date"
              >
                <MaterialIcons name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
          )}
          <View style={styles.toolbar}>
            <Pressable onPress={() => setShowNotes(true)} style={styles.tool} accessibilityLabel="Add details">
              <MaterialIcons name="notes" size={24} color={showNotes ? theme.primary : theme.textSecondary} />
            </Pressable>
            <Pressable onPress={() => setPicking(true)} style={styles.tool} accessibilityLabel="Add date/time">
              <MaterialIcons name="event" size={24} color={date.due ? theme.primary : theme.textSecondary} />
            </Pressable>
            <Pressable onPress={() => setStarred(!starred)} style={styles.tool} accessibilityLabel="Star">
              <MaterialIcons
                name={starred ? 'star' : 'star-border'}
                size={24}
                color={starred ? theme.primary : theme.textSecondary}
              />
            </Pressable>
            <View style={styles.spacer} />
            <TextButton label="Save" onPress={save} disabled={!title.trim()} />
          </View>
        </View>
      </BottomSheet>
      {picking && (
        <DatePickerDialog
          due={date.due}
          time={date.time}
          repeat={date.repeat}
          onDone={setDate}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20 },
  title: { fontSize: 18, paddingVertical: 10 },
  notes: { fontSize: 14, paddingVertical: 6, maxHeight: 120 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: -8 },
  tool: { padding: 8 },
  spacer: { flex: 1 },
});
