import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { DAYS_SHORT, formatDate, formatTime } from '../dates';
import { parseAmount } from '../money';
import { noOutline, useTheme } from '../theme';
import DatePickerDialog, { TimePickerDialog } from './DatePicker';
import { ConfirmDialog, TextButton } from './Overlays';
import { Button, TopBar } from './ui';

// fields: [{ key, label, type, required, placeholder, options, prefix, hint, visibleIf(values) }]
// types: text | multiline | phone | email | number | money | date | time | weekdays | select | toggle
const KEYBOARDS = { phone: 'phone-pad', email: 'email-address', number: 'number-pad', money: 'decimal-pad' };

function toInput(field, value) {
  if (field.type === 'weekdays') return Array.isArray(value) ? value : [];
  if (value === null || value === undefined) return field.type === 'toggle' ? false : '';
  if (field.type === 'number' || field.type === 'money') return String(value);
  return value;
}

function fromInput(field, value) {
  if (field.type === 'number' || field.type === 'money') return parseAmount(value);
  if (field.type === 'toggle') return !!value;
  if (field.type === 'weekdays') return value.length ? [...value].sort() : null;
  if (typeof value === 'string') return value.trim() || null;
  return value ?? null;
}

export default function FormScreen({ title, fields, initial = {}, onSave, onClose, onDelete, deleteLabel, deleteMessage }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.key, toInput(f, initial[f.key] ?? f.default)]))
  );
  const [errors, setErrors] = useState({});
  const [dateKey, setDateKey] = useState(null);
  const [timeKey, setTimeKey] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const set = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: null }));
  };
  const visible = fields.filter((f) => !f.visibleIf || f.visibleIf(values));

  const save = () => {
    const missing = {};
    for (const f of visible) {
      const v = values[f.key];
      if (f.required && (v === '' || v === null || v === undefined)) missing[f.key] = `${f.label} is required`;
      else if ((f.type === 'number' || f.type === 'money') && v !== '' && parseAmount(v) === null)
        missing[f.key] = `Enter a number for ${f.label.toLowerCase()}`;
    }
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }
    onSave(Object.fromEntries(visible.map((f) => [f.key, fromInput(f, values[f.key])])));
    onClose();
  };

  const renderField = (f) => {
    const error = errors[f.key];
    const borderColor = error ? theme.danger : theme.outline;
    const label = (
      <Text style={[styles.label, { color: error ? theme.danger : theme.textSecondary }]}>
        {f.label}
        {f.required ? ' *' : ''}
      </Text>
    );
    let control;

    if (f.type === 'select') {
      control = (
        <View style={styles.options}>
          {f.options.map((o) => {
            const active = values[f.key] === o.value;
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => set(f.key, o.value)}
                style={[
                  styles.option,
                  { borderColor: active ? theme.primaryContainer : theme.outline },
                  active && { backgroundColor: theme.primaryContainer },
                ]}
              >
                {active && <MaterialIcons name="check" size={16} color={theme.onPrimaryContainer} />}
                <Text style={{ color: active ? theme.onPrimaryContainer : theme.textSecondary, fontWeight: '500' }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      );
    } else if (f.type === 'toggle') {
      return (
        <View key={f.key} style={styles.toggleRow}>
          <View style={styles.flex}>
            <Text style={[styles.toggleLabel, { color: theme.text }]}>{f.label}</Text>
            {!!f.hint && <Text style={[styles.hint, { color: theme.muted }]}>{f.hint}</Text>}
          </View>
          <Switch
            value={!!values[f.key]}
            onValueChange={(v) => set(f.key, v)}
            trackColor={{ true: theme.primary, false: theme.outline }}
            thumbColor={theme.surface}
          />
        </View>
      );
    } else if (f.type === 'weekdays') {
      const selected = values[f.key];
      control = (
        <View style={styles.options}>
          {DAYS_SHORT.map((name, day) => {
            const active = selected.includes(day);
            return (
              <Pressable
                key={name}
                onPress={() => set(f.key, active ? selected.filter((d) => d !== day) : [...selected, day])}
                accessibilityLabel={name}
                accessibilityState={{ selected: active }}
                style={[
                  styles.dayChip,
                  { borderColor: active ? theme.primary : theme.outline },
                  active && { backgroundColor: theme.primary },
                ]}
              >
                <Text style={{ color: active ? theme.onPrimary : theme.textSecondary, fontWeight: '600' }}>{name.charAt(0)}</Text>
              </Pressable>
            );
          })}
        </View>
      );
    } else if (f.type === 'time') {
      const v = values[f.key];
      control = (
        <View style={[styles.inputBox, { borderColor }]}>
          <Pressable style={styles.dateValue} onPress={() => setTimeKey(f.key)}>
            <MaterialIcons name="access-time" size={20} color={theme.textSecondary} />
            <Text style={{ color: v ? theme.text : theme.muted, fontSize: 16 }}>{v ? formatTime(v) : f.placeholder || 'Select time'}</Text>
          </Pressable>
          {!!v && (
            <Pressable onPress={() => set(f.key, '')} hitSlop={8} accessibilityLabel={`Clear ${f.label}`}>
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      );
    } else if (f.type === 'date') {
      const v = values[f.key];
      control = (
        <View style={[styles.inputBox, { borderColor }]}>
          <Pressable style={styles.dateValue} onPress={() => setDateKey(f.key)}>
            <MaterialIcons name="event" size={20} color={theme.textSecondary} />
            <Text style={{ color: v ? theme.text : theme.muted, fontSize: 16 }}>{v ? formatDate(v) : 'Select date'}</Text>
          </Pressable>
          {!!v && (
            <Pressable onPress={() => set(f.key, '')} hitSlop={8} accessibilityLabel={`Clear ${f.label}`}>
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      );
    } else {
      control = (
        <View style={[styles.inputBox, { borderColor }, f.type === 'multiline' && styles.multilineBox]}>
          {!!f.prefix && <Text style={[styles.prefix, { color: theme.textSecondary }]}>{f.prefix}</Text>}
          <TextInput
            value={values[f.key]}
            onChangeText={(t) => set(f.key, t)}
            placeholder={f.placeholder}
            placeholderTextColor={theme.muted}
            keyboardType={KEYBOARDS[f.type] ?? 'default'}
            autoCapitalize={f.type === 'email' ? 'none' : 'sentences'}
            autoCorrect={f.type !== 'email'}
            multiline={f.type === 'multiline'}
            style={[styles.input, { color: theme.text }, f.type === 'multiline' && styles.multiline, noOutline]}
          />
        </View>
      );
    }

    return (
      <View key={f.key} style={styles.field}>
        {label}
        {control}
        {!!(error || f.hint) && <Text style={[styles.hint, { color: error ? theme.danger : theme.muted }]}>{error || f.hint}</Text>}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <TopBar title={title} onBack={onClose} backIcon="close" right={<TextButton label="Save" onPress={save} />} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
          {visible.map(renderField)}
          {onDelete && (
            <Button label={deleteLabel} icon="delete-outline" variant="danger" onPress={() => setConfirmingDelete(true)} style={styles.delete} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {dateKey && (
        <DatePickerDialog
          dateOnly
          due={values[dateKey] || null}
          onDone={({ due }) => set(dateKey, due)}
          onClose={() => setDateKey(null)}
        />
      )}
      {timeKey && (
        <TimePickerDialog time={values[timeKey] || null} onDone={(t) => set(timeKey, t ?? '')} onClose={() => setTimeKey(null)} />
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title={`${deleteLabel}?`}
          message={deleteMessage}
          confirmLabel="Delete"
          onConfirm={() => {
            onDelete();
            onClose();
          }}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, minHeight: 48 },
  multilineBox: { alignItems: 'flex-start' },
  prefix: { fontSize: 16, marginRight: 6 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 12, marginTop: 4 },
  dateValue: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  toggleLabel: { fontSize: 16 },
  delete: { marginTop: 8, alignSelf: 'flex-start' },
});
