// Installed app (Android / iOS): schedules reminder alerts on the phone itself. No internet needed.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const remindersSupported = true;

// iOS keeps at most 64 pending alerts per app, so schedule the soonest ones and top up on each open
const MAX_SCHEDULED = Platform.OS === 'ios' ? 60 : 300;
const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

// 'granted' | 'denied' | 'undetermined'
export async function getReminderPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestReminderPermission() {
  await ensureChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

// Replaces every scheduled alert with `reminders`. Returns how many were scheduled.
export async function scheduleReminders(reminders) {
  if ((await getReminderPermission()) !== 'granted') return 0;
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  const batch = reminders.slice(0, MAX_SCHEDULED);
  for (const r of batch) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL },
    });
  }
  return batch.length;
}

export async function cancelReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
