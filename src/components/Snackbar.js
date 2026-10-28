import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export default function Snackbar({ snack, onUndo, onDismiss }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!snack) return undefined;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [snack, onDismiss]);

  if (!snack) return null;
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: theme.snackbar }]}>
        <Text style={[styles.message, { color: theme.snackbarText }]}>{snack.message}</Text>
        <Pressable onPress={onUndo} hitSlop={8}>
          <Text style={[styles.action, { color: theme.snackbarAction }]}>Undo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 30, elevation: 30 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  message: { flex: 1, fontSize: 14 },
  action: { fontSize: 14, fontWeight: '600', marginLeft: 16 },
});
