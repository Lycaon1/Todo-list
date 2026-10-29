import { fromKey, todayKey } from '../../dates';
import { EVENT_CATEGORIES, EVENT_REPEATS } from '../../calendarStore';

// Works for saved events (id), new events (date) and not-yet-saved dictated drafts (draft + onDraftSave)
export function buildEventForm({ id, date, draft, onDraftSave }, { calendar, dispatch }) {
  const item = id ? calendar.events.find((e) => e.id === id) : null;
  const base = item ?? draft ?? { date: date ?? todayKey(), category: 'event' };

  return {
    title: item ? 'Edit event' : draft ? 'Check event' : 'New event',
    initial: { ...base, repeat: base.repeat ?? '', interval: Number(base.interval) || 1 },
    fields: [
      { key: 'title', label: 'Title', required: true, placeholder: "e.g. Mom's birthday, Soccer practice" },
      { key: 'category', label: 'Type', type: 'select', options: EVENT_CATEGORIES },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'time', label: 'Start time', type: 'time', placeholder: 'All day', hint: 'Leave empty for an all-day event' },
      { key: 'endTime', label: 'End time', type: 'time', placeholder: 'No end time', visibleIf: (v) => !!v.time },
      { key: 'repeat', label: 'Repeats', type: 'select', options: EVENT_REPEATS },
      { key: 'weekdays', label: 'On these days', type: 'weekdays', visibleIf: (v) => v.repeat === 'weekly' },
      {
        key: 'interval',
        label: 'How often',
        type: 'select',
        options: [
          { value: 1, label: 'Every week' },
          { value: 2, label: 'Every other week' },
        ],
        visibleIf: (v) => v.repeat === 'weekly',
      },
      { key: 'until', label: 'Ends on', type: 'date', hint: 'Leave empty to repeat forever', visibleIf: (v) => !!v.repeat },
      {
        key: 'birthYear',
        label: 'Year born or married',
        type: 'number',
        hint: 'Optional. Shows their age or how many years it has been.',
        visibleIf: (v) => v.category === 'birthday' || v.category === 'anniversary',
      },
      { key: 'notes', label: 'Notes', type: 'multiline' },
    ],
    onSave: (v) => {
      const values = { ...v, interval: v.interval ?? 1, birthYear: v.birthYear ?? null };
      if (!values.repeat && (values.category === 'birthday' || values.category === 'anniversary')) values.repeat = 'yearly';
      if (values.repeat === 'weekly' && !values.weekdays) values.weekdays = [fromKey(values.date).getDay()];
      if (values.repeat !== 'weekly') {
        values.weekdays = null;
        values.interval = 1;
      }
      if (!values.repeat) values.until = null;
      if (!values.time) values.endTime = null;
      if (draft) onDraftSave({ ...draft, ...values, missingDate: false });
      else if (item) dispatch({ type: 'UPDATE', id: item.id, changes: values });
      else dispatch({ type: 'ADD', items: [values] });
    },
    onDelete: item ? () => dispatch({ type: 'DELETE', id: item.id }) : undefined,
    deleteLabel: 'Delete event',
    deleteMessage: item?.repeat ? 'This deletes the event and all of its repeats.' : 'This event will be permanently deleted.',
  };
}
