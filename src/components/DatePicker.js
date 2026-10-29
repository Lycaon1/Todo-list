import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MONTHS_LONG, REPEAT_OPTIONS, formatTime, fromKey, toKey, todayKey } from '../dates';
import { useTheme } from '../theme';
import { Dialog, TextButton } from './Overlays';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n) => String(n).padStart(2, '0');

function buildMonth(month) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = Array(month.getDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(new Date(y, m, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function TimeEditor({ time, onChange }) {
  const theme = useTheme();
  const [h, m] = (time ?? '09:00').split(':').map(Number);
  const set = (hours, minutes) => onChange(`${pad((hours + 24) % 24)}:${pad((minutes + 60) % 60)}`);
  const isPm = h >= 12;

  const Stepper = ({ value, onUp, onDown, label }) => (
    <View style={styles.stepper}>
      <Pressable onPress={onUp} hitSlop={6} accessibilityLabel={`Increase ${label}`}>
        <MaterialIcons name="expand-less" size={28} color={theme.textSecondary} />
      </Pressable>
      <Text style={[styles.stepperValue, { color: theme.text }]}>{value}</Text>
      <Pressable onPress={onDown} hitSlop={6} accessibilityLabel={`Decrease ${label}`}>
        <MaterialIcons name="expand-more" size={28} color={theme.textSecondary} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.timeEditor}>
      <Stepper label="hour" value={h % 12 || 12} onUp={() => set(h + 1, m)} onDown={() => set(h - 1, m)} />
      <Text style={[styles.stepperValue, { color: theme.text }]}>:</Text>
      <Stepper label="minutes" value={pad(m)} onUp={() => set(h, m + 5 - (m % 5))} onDown={() => set(h, m % 5 ? m - (m % 5) : m - 5)} />
      <View style={styles.ampm}>
        {['AM', 'PM'].map((label) => {
          const active = (label === 'PM') === isPm;
          return (
            <Pressable
              key={label}
              onPress={() => !active && set(h + 12, m)}
              style={[styles.ampmBtn, active && { backgroundColor: theme.primaryContainer }]}
            >
              <Text style={{ color: active ? theme.onPrimaryContainer : theme.textSecondary, fontWeight: '600' }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// dateOnly hides the time and repeat options (used for forms like lease dates)
export default function DatePickerDialog({ due, time = null, repeat = null, dateOnly, onDone, onClose }) {
  const theme = useTheme();
  const today = todayKey();
  const [selected, setSelected] = useState(due ?? today);
  const [month, setMonth] = useState(() => {
    const d = fromKey(due ?? today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [pickedTime, setPickedTime] = useState(time);
  const [pickedRepeat, setPickedRepeat] = useState(repeat);
  const [panel, setPanel] = useState(null); // 'time' | 'repeat'

  const shiftMonth = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const repeatLabel = REPEAT_OPTIONS.find((o) => o.value === pickedRepeat)?.label;

  return (
    <Dialog
      onClose={onClose}
      actions={
        <>
          <TextButton label="Cancel" onPress={onClose} />
          <TextButton
            label="Done"
            onPress={() => {
              onClose();
              onDone({ due: selected, time: pickedTime, repeat: pickedRepeat });
            }}
          />
        </>
      }
    >
      <View style={styles.monthRow}>
        <Text style={[styles.monthLabel, { color: theme.text }]}>
          {MONTHS_LONG[month.getMonth()]} {month.getFullYear()}
        </Text>
        {dateOnly && (
          <Pressable onPress={() => shiftMonth(-12)} hitSlop={8} style={styles.monthBtn} accessibilityLabel="Previous year">
            <MaterialIcons name="keyboard-double-arrow-left" size={22} color={theme.textSecondary} />
          </Pressable>
        )}
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.monthBtn} accessibilityLabel="Previous month">
          <MaterialIcons name="chevron-left" size={24} color={theme.textSecondary} />
        </Pressable>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={8} style={styles.monthBtn} accessibilityLabel="Next month">
          <MaterialIcons name="chevron-right" size={24} color={theme.textSecondary} />
        </Pressable>
        {dateOnly && (
          <Pressable onPress={() => shiftMonth(12)} hitSlop={8} style={styles.monthBtn} accessibilityLabel="Next year">
            <MaterialIcons name="keyboard-double-arrow-right" size={22} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekday, { color: theme.textSecondary }]}>
            {d}
          </Text>
        ))}
        {buildMonth(month).map((key, i) => {
          if (!key) return <View key={i} style={styles.cell} />;
          const isSelected = key === selected;
          const isToday = key === today;
          return (
            <Pressable key={key} style={styles.cell} onPress={() => setSelected(key)}>
              <View
                style={[
                  styles.day,
                  isSelected && { backgroundColor: theme.primary },
                  !isSelected && isToday && { borderWidth: 1, borderColor: theme.primary },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? theme.onPrimary : isToday ? theme.primary : theme.text,
                    fontWeight: isSelected || isToday ? '600' : '400',
                  }}
                >
                  {fromKey(key).getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {!dateOnly && (
        <>
      <View style={[styles.divider, { backgroundColor: theme.divider }]} />

      <Pressable
        style={styles.optionRow}
        onPress={() => {
          if (panel !== 'time' && !pickedTime) setPickedTime('09:00');
          setPanel(panel === 'time' ? null : 'time');
        }}
      >
        <MaterialIcons name="access-time" size={22} color={theme.textSecondary} />
        <Text style={[styles.optionText, { color: theme.text }]}>
          {pickedTime ? formatTime(pickedTime) : 'Set time'}
        </Text>
        {!!pickedTime && (
          <Pressable onPress={() => setPickedTime(null)} hitSlop={8} accessibilityLabel="Clear time">
            <MaterialIcons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        )}
      </Pressable>
      {panel === 'time' && <TimeEditor time={pickedTime} onChange={setPickedTime} />}

      <Pressable style={styles.optionRow} onPress={() => setPanel(panel === 'repeat' ? null : 'repeat')}>
        <MaterialIcons name="repeat" size={22} color={theme.textSecondary} />
        <Text style={[styles.optionText, { color: theme.text }]}>{pickedRepeat ? repeatLabel : 'Repeat'}</Text>
      </Pressable>
      {panel === 'repeat' && (
        <View style={styles.chips}>
          {REPEAT_OPTIONS.map((o) => {
            const active = o.value === pickedRepeat;
            return (
              <Pressable
                key={o.label}
                onPress={() => setPickedRepeat(o.value)}
                style={[
                  styles.chip,
                  { borderColor: active ? theme.primaryContainer : theme.outline },
                  active && { backgroundColor: theme.primaryContainer },
                ]}
              >
                <Text style={{ color: active ? theme.onPrimaryContainer : theme.textSecondary, fontSize: 13 }}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
        </>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  monthLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  monthBtn: { padding: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginVertical: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 16 },
  optionText: { flex: 1, fontSize: 15 },
  timeEditor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8 },
  stepper: { alignItems: 'center' },
  stepperValue: { fontSize: 26, fontWeight: '500', minWidth: 36, textAlign: 'center' },
  ampm: { marginLeft: 12, gap: 6 },
  ampmBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8, paddingLeft: 38 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
});

export function TimePickerDialog({ time, onDone, onClose }) {
  const [picked, setPicked] = useState(time || '09:00');
  return (
    <Dialog
      title={formatTime(picked)}
      onClose={onClose}
      actions={
        <>
          <TextButton
            label="No time"
            onPress={() => {
              onClose();
              onDone(null);
            }}
          />
          <TextButton label="Cancel" onPress={onClose} />
          <TextButton
            label="Done"
            onPress={() => {
              onClose();
              onDone(picked);
            }}
          />
        </>
      }
    >
      <TimeEditor time={picked} onChange={setPicked} />
    </Dialog>
  );
}
