// Dates are stored as local 'YYYY-MM-DD' strings and times as 'HH:mm' (24h)

const pad = (n) => String(n).padStart(2, '0');

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const REPEAT_OPTIONS = [
  { value: null, label: "Doesn't repeat" },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const REPEAT_TEXT = {
  daily: 'Repeats every day',
  weekly: 'Repeats every week',
  monthly: 'Repeats every month',
  yearly: 'Repeats every year',
};

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toKey(new Date());

export const addDays = (key, n) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

// Whole days from today to the given date (negative = past)
export const dayDiff = (key) => Math.round((fromKey(key) - fromKey(todayKey())) / 86400000);

export function formatTime(time) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatDate(key) {
  const diff = dayDiff(key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = fromKey(key);
  const base = `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

export function formatDue(due, time) {
  return time ? `${formatDate(due)}, ${formatTime(time)}` : formatDate(due);
}

export const formatRepeat = (repeat) => REPEAT_TEXT[repeat] ?? '';

export function isOverdue(due, time) {
  const diff = dayDiff(due);
  if (diff < 0) return true;
  if (diff === 0 && time) {
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
  }
  return false;
}

export function nextRepeatDate(key, repeat) {
  const d = fromKey(key);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeat === 'monthly' || repeat === 'yearly') {
    // Clamp to the last day of the target month (Jan 31 -> Feb 28)
    const day = d.getDate();
    d.setDate(1);
    if (repeat === 'monthly') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
  }
  return toKey(d);
}

// Section heading used when a list is sorted by date
export function dateGroupLabel(due) {
  if (!due) return 'No due date';
  return dayDiff(due) < 0 ? 'Past' : formatDate(due);
}
