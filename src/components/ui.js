import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export function toneColors(theme, tone) {
  switch (tone) {
    case 'success':
      return { fg: theme.onSuccessContainer, bg: theme.successContainer, solid: theme.success };
    case 'warning':
      return { fg: theme.onWarningContainer, bg: theme.warningContainer, solid: theme.warning };
    case 'danger':
      return { fg: theme.onDangerContainer, bg: theme.dangerContainer, solid: theme.danger };
    case 'primary':
      return { fg: theme.onPrimaryContainer, bg: theme.primaryContainer, solid: theme.primary };
    default:
      return { fg: theme.textSecondary, bg: theme.surfaceAlt, solid: theme.textSecondary };
  }
}

export function IconButton({ icon, onPress, label, color, size = 24 }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: theme.pressed }]}
    >
      <MaterialIcons name={icon} size={size} color={color ?? theme.textSecondary} />
    </Pressable>
  );
}

export function TopBar({ title, onBack, backIcon = 'arrow-back', right, large }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
      {onBack ? (
        <IconButton icon={backIcon} onPress={onBack} label={backIcon === 'close' ? 'Close' : 'Back'} color={theme.text} />
      ) : (
        <View style={styles.topBarSpacer} />
      )}
      <Text numberOfLines={1} style={[large ? styles.titleLarge : styles.title, { color: theme.text }]}>
        {title}
      </Text>
      <View style={styles.row}>{right}</View>
    </View>
  );
}

export function Fab({ icon = 'add', label, onPress }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        label && styles.fabExtended,
        { backgroundColor: theme.fab, bottom: insets.bottom + 16, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <MaterialIcons name={icon} size={label ? 24 : 30} color={theme.fabIcon} />
      {!!label && <Text style={[styles.fabLabel, { color: theme.fabIcon }]}>{label}</Text>}
    </Pressable>
  );
}

export function Button({ label, icon, onPress, variant = 'filled', disabled, style }) {
  const theme = useTheme();
  const colors = {
    filled: { bg: theme.primary, fg: theme.onPrimary, border: 'transparent' },
    tonal: { bg: theme.primaryContainer, fg: theme.onPrimaryContainer, border: 'transparent' },
    outlined: { bg: 'transparent', fg: theme.primary, border: theme.outline },
    danger: { bg: 'transparent', fg: theme.danger, border: theme.outline },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {!!icon && <MaterialIcons name={icon} size={18} color={colors.fg} />}
      <Text style={[styles.buttonLabel, { color: colors.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, tone = 'neutral', icon }) {
  const theme = useTheme();
  const c = toneColors(theme, tone);
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      {!!icon && <MaterialIcons name={icon} size={14} color={c.fg} />}
      <Text style={[styles.chipText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Segmented({ options, value, onChange, inset = 16 }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.segmented, { paddingHorizontal: inset }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              { borderColor: active ? theme.primaryContainer : theme.outline },
              active && { backgroundColor: theme.primaryContainer },
            ]}
          >
            {active && <MaterialIcons name="check" size={16} color={theme.onPrimaryContainer} />}
            <Text style={[styles.segmentText, { color: active ? theme.onPrimaryContainer : theme.textSecondary }]}>
              {o.label}
              {o.count !== undefined ? ` (${o.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Card({ children, onPress, style }) {
  const theme = useTheme();
  const base = [styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, right }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, body, action }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primaryContainer }]}>
        <MaterialIcons name={icon} size={40} color={theme.onPrimaryContainer} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      {!!body && <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{body}</Text>}
      {action}
    </View>
  );
}

export function InfoRow({ icon, label, value, onPress, right }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.infoRow, pressed && { backgroundColor: theme.pressed }]}>
      <MaterialIcons name={icon} size={22} color={theme.textSecondary} style={styles.infoIcon} />
      <View style={styles.flex}>
        <Text style={[styles.infoLabel, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: onPress ? theme.primary : theme.text }]}>{value}</Text>
      </View>
      {right}
    </Pressable>
  );
}

export function ProgressBar({ value, tone = 'primary' }) {
  const theme = useTheme();
  const c = toneColors(theme, tone);
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.surfaceAlt }]}>
      <View style={[styles.progressFill, { backgroundColor: c.solid, width: `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 10, borderRadius: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 4, minHeight: 56 },
  topBarSpacer: { width: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '500', marginLeft: 4 },
  titleLarge: { flex: 1, fontSize: 26, fontWeight: '500', marginLeft: 4 },
  fab: {
    position: 'absolute',
    right: 16,
    height: 56,
    minWidth: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabExtended: { paddingHorizontal: 16, gap: 8 },
  fabLabel: { fontSize: 15, fontWeight: '600' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  buttonLabel: { fontSize: 14, fontWeight: '600' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: '600' },
  segmented: { gap: 8, paddingVertical: 4 },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 34 },
  segmentText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40, gap: 8 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 20 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8 },
  infoIcon: { width: 36 },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 15, marginTop: 1 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
});
