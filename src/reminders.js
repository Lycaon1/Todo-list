// Works out which reminder alerts are due over the next few weeks. Pure logic, shared by every platform.
import { addDays, formatTime, todayKey } from './dates';
import { milestone, occursOn } from './calendarStore';

export const REMINDER_OPTIONS = [
  { value: 1440, label: '24 hours before' },
  { value: 720, label: '12 hours before' },
  { value: 360, label: '6 hours before' },
  { value: 60, label: '1 hour before' },
  { value: 0, label: 'When it starts' },
];
export const DEFAULT_REMINDERS = [1440, 720, 360, 60, 0];

// All-day events and tasks have no time, so they get a morning reminder instead of mid-night ones
const ALL_DAY_HOUR = 9;
const WINDOW_DAYS = 30;

function startOf(key, time) {
  const [y, m, d] = key.split('-').map(Number);
  const [h, min] = time ? time.split(':').map(Number) : [ALL_DAY_HOUR, 0];
  return new Date(y, m - 1, d, h, min);
}

function message(offset, time) {
  if (!time) return offset >= 1440 ? 'Tomorrow' : 'Today';
  const at = formatTime(time);
  if (offset === 0) return `Starting now (${at})`;
  if (offset === 1440) return `Tomorrow at ${at}`;
  return `In ${offset / 60} hour${offset === 60 ? '' : 's'}, at ${at}`;
}

// For all-day items: a reminder the morning before (if 24 hours is chosen) and the morning of
function allDayOffsets(offsets) {
  const result = [];
  if (offsets.includes(1440)) result.push(1440);
  if (offsets.some((o) => o < 1440)) result.push(0);
  return result;
}

// Returns [{ id, fireAt, title, body }] sorted soonest first
export function upcomingReminders({ events, tasks, defaults = DEFAULT_REMINDERS, now = new Date(), days = WINDOW_DAYS }) {
  const limit = now.getTime() + days * 86400000;
  const today = todayKey();
  const reminders = [];

  const add = ({ id, key, time, title, extra, offsets }) => {
    const start = startOf(key, time);
    for (const offset of time ? offsets : allDayOffsets(offsets)) {
      const fireAt = new Date(start.getTime() - offset * 60000);
      if (fireAt.getTime() <= now.getTime() || fireAt.getTime() > limit) continue;
      reminders.push({
        id: `${id}-${key}-${offset}`,
        fireAt,
        title,
        body: extra ? `${message(offset, time)} · ${extra}` : message(offset, time),
      });
    }
  };

  // Look one extra day ahead so "24 hours before" alerts at the edge of the window are included
  for (let i = 0; i <= days + 1; i++) {
    const key = addDays(today, i);
    for (const event of events) {
      if (!occursOn(event, key)) continue;
      add({
        id: `e-${event.id}`,
        key,
        time: event.time,
        title: event.title,
        extra: milestone(event, key),
        offsets: event.reminders ?? defaults,
      });
    }
  }
  for (const task of tasks) {
    if (task.done || !task.due) continue;
    add({ id: `t-${task.id}`, key: task.due, time: task.time, title: task.title, extra: 'Task', offsets: defaults });
  }

  return reminders.sort((a, b) => a.fireAt - b.fireAt);
}

export const reminderSummary = (offsets) =>
  offsets.length
    ? REMINDER_OPTIONS.filter((o) => offsets.includes(o.value))
        .map((o) => o.label.replace(' before', ''))
        .join(', ')
    : 'No reminders';
