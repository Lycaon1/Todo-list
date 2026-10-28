import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate, formatDue, isOverdue, toKey } from '../dates';
import { useTheme } from '../theme';

export function Checkbox({ done, onPress, size = 22 }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.checkWrap}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? 'Mark not complete' : 'Mark complete'}
    >
      {done ? (
        <MaterialIcons name="check" size={size} color={theme.primary} />
      ) : (
        <View style={[styles.circle, { width: size - 2, height: size - 2, borderColor: theme.textSecondary }]} />
      )}
    </Pressable>
  );
}

export default function TaskRow({ task, indent, subtitle, onPress, onToggle, onStar }) {
  const theme = useTheme();
  const overdue = !!task.due && !task.done && isOverdue(task.due, task.time);
  const dueColor = overdue ? theme.danger : theme.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { paddingLeft: indent ? 56 : 16 },
        pressed && { backgroundColor: theme.pressed },
      ]}
    >
      <Checkbox done={task.done} onPress={onToggle} />

      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            { color: theme.text },
            task.done && { color: theme.muted, textDecorationLine: 'line-through' },
          ]}
        >
          {task.title || '(untitled task)'}
        </Text>

        {!!task.notes && !task.done && (
          <Text numberOfLines={2} style={[styles.notes, { color: theme.textSecondary }]}>
            {task.notes}
          </Text>
        )}

        {!!subtitle && <Text style={[styles.meta, { color: theme.muted }]}>{subtitle}</Text>}

        {!!task.due && !task.done && (
          <View style={[styles.chip, { borderColor: overdue ? theme.danger : theme.outline }]}>
            <Text style={[styles.chipText, { color: dueColor }]}>{formatDue(task.due, task.time)}</Text>
            {!!task.repeat && <MaterialIcons name="repeat" size={14} color={dueColor} style={styles.chipIcon} />}
          </View>
        )}

        {task.done && !!task.completedAt && (
          <Text style={[styles.meta, { color: theme.muted }]}>
            Completed: {formatDate(toKey(new Date(task.completedAt)))}
          </Text>
        )}
      </View>

      {!task.done && (
        <Pressable
          onPress={onStar}
          hitSlop={10}
          style={styles.star}
          accessibilityLabel={task.starred ? 'Remove star' : 'Add star'}
        >
          <MaterialIcons
            name={task.starred ? 'star' : 'star-border'}
            size={22}
            color={task.starred ? theme.primary : theme.textSecondary}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingRight: 8 },
  checkWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16, marginTop: 0 },
  circle: { borderRadius: 999, borderWidth: 2 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 22 },
  notes: { fontSize: 14, lineHeight: 19, marginTop: 2 },
  meta: { fontSize: 12, marginTop: 3 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  chipText: { fontSize: 12, fontWeight: '500' },
  chipIcon: { marginLeft: 4 },
  star: { paddingHorizontal: 8, paddingTop: 0 },
});
