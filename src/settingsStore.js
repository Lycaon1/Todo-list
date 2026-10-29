import { usePersistentReducer } from './storage';
import { DEFAULT_REMINDERS } from './reminders';

export const CURRENCIES = [
  { value: 'USD', label: 'US dollar' },
  { value: 'INR', label: 'Indian rupee' },
  { value: 'GBP', label: 'British pound' },
  { value: 'EUR', label: 'Euro' },
  { value: 'CAD', label: 'Canadian dollar' },
  { value: 'AUD', label: 'Australian dollar' },
  { value: 'AED', label: 'UAE dirham' },
  { value: 'SGD', label: 'Singapore dollar' },
];

const REGION_CURRENCY = {
  US: 'USD', IN: 'INR', GB: 'GBP', CA: 'CAD', AU: 'AUD', AE: 'AED', SG: 'SGD',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR',
};

function guessCurrency() {
  try {
    const region = Intl.DateTimeFormat().resolvedOptions().locale.split('-').pop().toUpperCase();
    return REGION_CURRENCY[region] ?? 'USD';
  } catch {
    return 'USD';
  }
}

const createInitial = () => ({
  currency: guessCurrency(),
  lastBackupAt: null,
  remindersOn: true,
  defaultReminders: DEFAULT_REMINDERS,
  askedForReminders: false,
});

export function normalizeSettings(saved) {
  if (!saved || typeof saved !== 'object') return null;
  return { ...createInitial(), ...saved };
}

function reducer(state, action) {
  if (action.type === 'SET') return { ...state, ...action.changes };
  return state;
}

export function useSettingsStore() {
  return usePersistentReducer('@settings_v1', reducer, createInitial, normalizeSettings);
}
