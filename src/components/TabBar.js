import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

// tabs: [{ key, label, icon, badge }]
export default function TabBar({ tabs, current, onChange }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.divider, paddingBottom: insets.bottom + 8 }]}>
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
          >
            <View style={[styles.pill, active && { backgroundColor: theme.primaryContainer }]}>
              <MaterialIcons name={t.icon} size={24} color={active ? theme.onPrimaryContainer : theme.textSecondary} />
              {t.badge && <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.surface }]} />}
            </View>
            <Text style={[styles.label, { color: active ? theme.text : theme.textSecondary, fontWeight: active ? '700' : '500' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  pill: { width: 60, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 3, right: 16, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  label: { fontSize: 12 },
});
