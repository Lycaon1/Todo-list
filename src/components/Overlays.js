import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { noOutline, useTheme } from '../theme';

const useNativeDriver = Platform.OS !== 'web';

// Full-screen layer with a dimmed backdrop. Rendered inside the app's own view
// so it behaves the same on Android, iOS and web.
function Overlay({ onClose, center, children }) {
  const theme = useTheme();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver }).start();
  }, [fade]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, styles.layer]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim, opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <View style={[styles.fill, center ? styles.center : styles.bottom]} pointerEvents="box-none">
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

export function BottomSheet({ onClose, children }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver }).start();
  }, [slide]);

  return (
    <Overlay onClose={onClose}>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, paddingBottom: insets.bottom + 8, transform: [{ translateY: slide }] },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.outline }]} />
        {children}
      </Animated.View>
    </Overlay>
  );
}

export function Dialog({ title, onClose, children, actions }) {
  const theme = useTheme();
  return (
    <Overlay onClose={onClose} center>
      <View style={[styles.dialog, { backgroundColor: theme.surface }]}>
        {!!title && <Text style={[styles.dialogTitle, { color: theme.text }]}>{title}</Text>}
        {children}
        {actions && <View style={styles.dialogActions}>{actions}</View>}
      </View>
    </Overlay>
  );
}

export function TextButton({ label, onPress, disabled, color }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.textButton, pressed && { backgroundColor: theme.pressed }]}
    >
      <Text style={[styles.textButtonLabel, { color: disabled ? theme.muted : color ?? theme.primary }]}>{label}</Text>
    </Pressable>
  );
}

// options: [{ label, icon, onPress, checked, disabled, hint, danger } | { header }]
export function OptionSheet({ options, onClose }) {
  const theme = useTheme();
  return (
    <BottomSheet onClose={onClose}>
      {options.map((opt, i) =>
        opt.header ? (
          <Text key={`h${i}`} style={[styles.optionHeader, { color: theme.textSecondary }]}>
            {opt.header}
          </Text>
        ) : (
          <Pressable
            key={opt.label}
            disabled={opt.disabled}
            onPress={() => {
              onClose();
              opt.onPress();
            }}
            style={({ pressed }) => [styles.option, pressed && { backgroundColor: theme.pressed }]}
          >
            <View style={styles.optionIcon}>
              {opt.checked ? (
                <MaterialIcons name="check" size={22} color={theme.primary} />
              ) : opt.icon ? (
                <MaterialIcons name={opt.icon} size={22} color={opt.disabled ? theme.outline : theme.textSecondary} />
              ) : null}
            </View>
            <View style={styles.fill}>
              <Text
                style={[
                  styles.optionLabel,
                  { color: opt.disabled ? theme.muted : opt.danger ? theme.danger : theme.text },
                ]}
              >
                {opt.label}
              </Text>
              {!!opt.hint && <Text style={[styles.optionHint, { color: theme.muted }]}>{opt.hint}</Text>}
            </View>
          </Pressable>
        )
      )}
    </BottomSheet>
  );
}

export function PromptDialog({ title, initial = '', placeholder, confirmLabel = 'Done', onConfirm, onClose }) {
  const theme = useTheme();
  const [value, setValue] = useState(initial);
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onClose();
    onConfirm(text);
  };
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <TextButton label="Cancel" onPress={onClose} />
          <TextButton label={confirmLabel} onPress={submit} disabled={!value.trim()} />
        </>
      }
    >
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        autoFocus
        onSubmitEditing={submit}
        returnKeyType="done"
        style={[styles.promptInput, { color: theme.text, borderColor: theme.primary }, noOutline]}
      />
    </Dialog>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }) {
  const theme = useTheme();
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <TextButton label="Cancel" onPress={onClose} />
          <TextButton
            label={confirmLabel}
            onPress={() => {
              onClose();
              onConfirm();
            }}
          />
        </>
      }
    >
      <Text style={[styles.dialogMessage, { color: theme.textSecondary }]}>{message}</Text>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 20, elevation: 20 },
  fill: { flex: 1 },
  bottom: { justifyContent: 'flex-end' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8 },
  handle: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8, opacity: 0.8 },
  dialog: { width: '100%', maxWidth: 360, borderRadius: 28, padding: 24 },
  dialogTitle: { fontSize: 22, marginBottom: 16 },
  dialogMessage: { fontSize: 14, lineHeight: 20 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 4 },
  textButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20 },
  textButtonLabel: { fontSize: 14, fontWeight: '600' },
  optionHeader: { fontSize: 13, fontWeight: '600', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  optionIcon: { width: 40 },
  optionLabel: { fontSize: 16 },
  optionHint: { fontSize: 12, marginTop: 2 },
  promptInput: { fontSize: 16, borderBottomWidth: 2, paddingVertical: 8 },
});
