import { usePersistentReducer } from './storage';
import { uid } from './store';
import { DAYS_SHORT, MONTHS_SHORT, addDays, formatLongDate, fromKey } from './dates';
import { ordinal } from './propertyStore';

export const EVENT_CATEGORIES = [
  { value: 'event', label: 'General', icon: 'event' },
  { value: 'birthday', label: 'Birthday', icon: 'cake' },
  { value: 'anniversary', label: 'Anniversary', icon: 'favorite' },
  { value: 'appointment', label: 'Appointment', icon: 'medical-services' },
  { value: 'kids', label: 'Kids & school', icon: 'school' },
  { value: 'property', label: 'Property', icon: 'apartment' },
  { value: 'bills', label: 'Bills & payments', icon: 'receipt-long' },
];

export const EVENT_REPEATS = [
  { value: '', label: "Doesn't repeat" },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export const categoryIcon = (category) => EVENT_CATEGORIES.find((c) => c.value === category)?.icon ?? 'event';

export function normalizeCalendar(saved) {
  if (!saved || !Array.isArray(saved.events)) return null;
  return { events: saved.events };
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return { events: [...state.events, ...action.items.map((item) => ({ ...item, id: uid(), createdAt: Date.now() }))] };
    case 'UPDATE':
      return { events: state.events.map((e) => (e.id === action.id ? { ...e, ...action.changes } : e)) };
    case 'DELETE':
      return { events: state.events.filter((e) => e.id !== action.id) };
    default:
      return state;
  }
}

export function useCalendarStore() {
  return usePersistentReducer('@calendar_v1', reducer, () => ({ events: [] }), normalizeCalendar);
}

// ---- Repeats ----

const DAY_MS = 86400000;
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / DAY_MS);
const lastDayOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

export function occursOn(event, key) {
  if (!event.date || key < event.date) return false;
  if (event.until && key > event.until) return false;
  const start = fromKey(event.date);
  const day = fromKey(key);
  const interval = Number(event.interval) > 1 ? Number(event.interval) : 1;
  switch (event.repeat) {
    case 'daily':
      return daysBetween(event.date, key) % interval === 0;
    case 'weekly': {
      const weekdays = event.weekdays?.length ? event.weekdays : [start.getDay()];
      if (!weekdays.includes(day.getDay())) return false;
      if (interval === 1) return true;
      // Compare the Sundays that start each week
      const weeks = Math.round((daysBetween(event.date, key) + start.getDay() - day.getDay()) / 7);
      return weeks % interval === 0;
    }
    case 'monthly':
      return day.getDate() === Math.min(start.getDate(), lastDayOfMonth(day));
    case 'yearly':
      return day.getMonth() === start.getMonth() && day.getDate() === Math.min(start.getDate(), lastDayOfMonth(day));
    default:
      return key === event.date;
  }
}

// The first date on or after `from` when the event happens, or null if it never does again
export function nextOccurrence(event, from, maxDays = 400) {
  let key = event.date > from ? event.date : from;
  for (let i = 0; i < maxDays; i++) {
    if (event.until && key > event.until) return null;
    if (occursOn(event, key)) return key;
    if (!event.repeat) return null;
    key = addDays(key, 1);
  }
  return null;
}

export function describeRepeat(event) {
  const start = fromKey(event.date);
  let text;
  switch (event.repeat) {
    case 'daily':
      text = 'Every day';
      break;
    case 'weekly': {
      const days = (event.weekdays?.length ? event.weekdays : [start.getDay()]).map((d) => DAYS_SHORT[d]);
      const list = days.length === 5 && !days.includes('Sat') && !days.includes('Sun') ? 'weekday' : days.join(', ');
      text = `${Number(event.interval) > 1 ? 'Every other' : 'Every'} ${list}`;
      break;
    }
    case 'monthly':
      text = `Monthly on the ${ordinal(start.getDate())}`;
      break;
    case 'yearly':
      text = `Every year on ${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}`;
      break;
    default:
      return `${DAYS_SHORT[start.getDay()]}, ${formatLongDate(event.date)}`;
  }
  return event.until ? `${text} until ${formatLongDate(event.until)}` : text;
}

// "Turns 41" for birthdays and "15th anniversary" when the year is known
export function milestone(event, key) {
  if (!event.birthYear) return null;
  const years = fromKey(key).getFullYear() - Number(event.birthYear);
  if (years <= 0) return null;
  if (event.category === 'birthday') return `Turns ${years}`;
  if (event.category === 'anniversary') return `${ordinal(years)} anniversary`;
  return null;
}
