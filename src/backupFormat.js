import { normalizeTaskState } from './store';
import { normalizePropertyData } from './propertyStore';
import { normalizeCalendar } from './calendarStore';
import { todayKey } from './dates';

const APP_ID = 'anjalis-world';

export const backupFileName = () => `anjalis-world-backup-${todayKey()}.json`;

export function buildBackup({ tasks, properties, calendar, settings }) {
  return JSON.stringify({
    app: APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    properties,
    calendar,
    settings: { currency: settings.currency },
  });
}

// Throws an Error with a readable message when the file is not a usable backup
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a backup from this app.");
  }
  if (backup?.app !== APP_ID) throw new Error("This file isn't a backup from this app.");
  const tasks = normalizeTaskState(backup.tasks);
  const properties = normalizePropertyData(backup.properties);
  if (!tasks || !properties) throw new Error('This backup file is damaged and cannot be restored.');
  // Backups made before the calendar existed have no calendar section
  const calendar = backup.calendar === undefined ? { events: [] } : normalizeCalendar(backup.calendar);
  if (!calendar) throw new Error('This backup file is damaged and cannot be restored.');
  return { tasks, properties, calendar, settings: backup.settings ?? {}, exportedAt: backup.exportedAt };
}
