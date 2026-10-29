import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatLongDate, plural, toKey } from '../dates';
import { currencySymbol } from '../money';
import { CURRENCIES } from '../settingsStore';
import { buildBackup, backupFileName, parseBackup } from '../backupFormat';
import { pickBackupFile, saveBackupFile } from '../backup';
import { useTheme } from '../theme';
import { Button, Card, InfoRow, TopBar } from '../components/ui';
import { ConfirmDialog, Dialog, OptionSheet, TextButton } from '../components/Overlays';

const BACKUP_STALE_MS = 14 * 24 * 60 * 60 * 1000;

export function backupIsStale(settings) {
  return !settings.lastBackupAt || Date.now() - settings.lastBackupAt > BACKUP_STALE_MS;
}

export default function More({ tasks, properties, settings, settingsDispatch, onRestore, showMessage }) {
  const theme = useTheme();
  const [pendingRestore, setPendingRestore] = useState(null);
  const [error, setError] = useState(null);
  const [choosingCurrency, setChoosingCurrency] = useState(false);
  const stale = backupIsStale(settings);

  const backup = () => {
    saveBackupFile(backupFileName(), buildBackup({ tasks, properties, settings }))
      .then((result) => {
        if (result !== 'saved') return;
        settingsDispatch({ type: 'SET', changes: { lastBackupAt: Date.now() } });
        showMessage('Backup saved');
      })
      .catch(() => setError('The backup could not be saved. Please try again.'));
  };

  const restore = () => {
    pickBackupFile()
      .then((text) => {
        if (text === null) return;
        try {
          setPendingRestore(parseBackup(text));
        } catch (e) {
          setError(e.message);
        }
      })
      .catch(() => setError('That file could not be opened.'));
  };

  const currency = CURRENCIES.find((c) => c.value === settings.currency);
  const taskCount = tasks.tasks.filter((t) => !t.done).length;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopBar title="More" large />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.cardHead}>
            <MaterialIcons name="backup" size={24} color={stale ? theme.danger : theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Backup</Text>
          </View>
          <Text style={[styles.body, { color: stale ? theme.danger : theme.textSecondary }]}>
            {settings.lastBackupAt
              ? `Last backup: ${formatLongDate(toKey(new Date(settings.lastBackupAt)))}`
              : "You haven't made a backup yet."}
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Your data lives only on this phone. Save a backup file to Files, iCloud Drive, Google Drive or email regularly, so you
            can restore everything if your phone is lost or replaced.
          </Text>
          <View style={styles.buttons}>
            <Button label="Back up now" icon="file-download" onPress={backup} />
            <Button label="Restore" icon="restore" variant="outlined" onPress={restore} />
          </View>
        </Card>

        <Card>
          <View style={styles.cardHead}>
            <MaterialIcons name="settings" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Settings</Text>
          </View>
          <InfoRow
            icon="payments"
            label="Currency"
            value={`${currency?.label ?? settings.currency} (${currencySymbol(settings.currency)})`}
            onPress={() => setChoosingCurrency(true)}
          />
        </Card>

        <Card>
          <View style={styles.cardHead}>
            <MaterialIcons name="cloud-off" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Works offline</Text>
          </View>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Everything you enter is stored only on this phone. Nothing is uploaded to the internet.
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            {plural(taskCount, 'open task')} · {plural(properties.properties.length, 'property', 'properties')} ·{' '}
            {plural(properties.tenants.filter((t) => !t.movedOut).length, 'tenant')}
          </Text>
        </Card>
      </ScrollView>

      {choosingCurrency && (
        <OptionSheet
          options={[
            { header: 'Currency' },
            ...CURRENCIES.map((c) => ({
              label: `${c.label} (${currencySymbol(c.value)})`,
              checked: c.value === settings.currency,
              onPress: () => settingsDispatch({ type: 'SET', changes: { currency: c.value } }),
            })),
          ]}
          onClose={() => setChoosingCurrency(false)}
        />
      )}
      {pendingRestore && (
        <ConfirmDialog
          title="Replace all data?"
          message={`This replaces everything in the app with the backup from ${
            pendingRestore.exportedAt ? formatLongDate(toKey(new Date(pendingRestore.exportedAt))) : 'this file'
          }: ${plural(pendingRestore.tasks.tasks.length, 'task')} and ${plural(pendingRestore.properties.properties.length, 'property', 'properties')}. Anything added after that backup will be lost.`}
          confirmLabel="Restore"
          onConfirm={() => {
            onRestore(pendingRestore);
            showMessage('Backup restored');
          }}
          onClose={() => setPendingRestore(null)}
        />
      )}
      {error && (
        <Dialog title="Something went wrong" onClose={() => setError(null)} actions={<TextButton label="OK" onPress={() => setError(null)} />}>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{error}</Text>
        </Dialog>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 40, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '500' },
  body: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
});
