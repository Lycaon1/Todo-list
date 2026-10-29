import { usePersistentReducer } from './storage';
import { uid } from './store';
import { MONTHS_LONG, dayDiff } from './dates';

const COLLECTIONS = ['properties', 'tenants', 'payments', 'repairs', 'expenses', 'vendors'];

const createInitial = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));

export function normalizePropertyData(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const data = createInitial();
  for (const c of COLLECTIONS) {
    if (saved[c] !== undefined && !Array.isArray(saved[c])) return null;
    data[c] = saved[c] ?? [];
  }
  return data;
}

function remove(state, collection, test) {
  return { ...state, [collection]: state[collection].filter((item) => !test(item)) };
}

function reducer(state, action) {
  const { collection } = action;
  switch (action.type) {
    case 'ADD':
      return { ...state, [collection]: [...state[collection], { ...action.item, id: action.item.id ?? uid(), createdAt: Date.now() }] };

    case 'UPDATE':
      return {
        ...state,
        [collection]: state[collection].map((item) => (item.id === action.id ? { ...item, ...action.changes } : item)),
      };

    case 'DELETE': {
      let next = remove(state, collection, (item) => item.id === action.id);
      if (collection === 'properties') {
        const tenantIds = new Set(state.tenants.filter((t) => t.propertyId === action.id).map((t) => t.id));
        next = remove(next, 'tenants', (t) => tenantIds.has(t.id));
        next = remove(next, 'payments', (p) => tenantIds.has(p.tenantId));
        next = remove(next, 'repairs', (r) => r.propertyId === action.id);
        next = remove(next, 'expenses', (e) => e.propertyId === action.id);
      } else if (collection === 'tenants') {
        next = remove(next, 'payments', (p) => p.tenantId === action.id);
      } else if (collection === 'vendors') {
        next = { ...next, repairs: next.repairs.map((r) => (r.vendorId === action.id ? { ...r, vendorId: null } : r)) };
      }
      return next;
    }

    default:
      return state;
  }
}

export function usePropertyStore() {
  return usePersistentReducer('@properties_v1', reducer, createInitial, normalizePropertyData);
}

// ---- Rent and lease logic ----

const pad = (n) => String(n).padStart(2, '0');

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function formatMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// A tenant owes rent for a month if they haven't moved out and their lease has started by then
export function owesRentIn(tenant, month) {
  if (tenant.movedOut || !(Number(tenant.rent) > 0)) return false;
  return !tenant.leaseStart || tenant.leaseStart.slice(0, 7) <= month;
}

// status: 'paid' | 'partial' | 'late' | 'due'
export function rentStatus(tenant, payments, month) {
  const rent = Number(tenant.rent) || 0;
  const paid = payments
    .filter((p) => p.tenantId === tenant.id && p.month === month)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  let status;
  if (paid >= rent) status = 'paid';
  else if (paid > 0) status = 'partial';
  else {
    const current = monthKey();
    const pastDueDay = new Date().getDate() > (Number(tenant.dueDay) || 1);
    status = month < current || (month === current && pastDueDay) ? 'late' : 'due';
  }
  return { rent, paid, status, balance: Math.max(rent - paid, 0) };
}

export const RENT_STATUS = {
  paid: { label: 'Paid', tone: 'success' },
  partial: { label: 'Partly paid', tone: 'warning' },
  late: { label: 'Late', tone: 'danger' },
  due: { label: 'Due', tone: 'neutral' },
};

export function leaseAlert(tenant) {
  if (!tenant.leaseEnd || tenant.movedOut) return null;
  const days = dayDiff(tenant.leaseEnd);
  if (days < 0) return { text: 'Lease ended', tone: 'danger' };
  if (days <= 60) return { text: days === 0 ? 'Lease ends today' : `Lease ends in ${days} day${days === 1 ? '' : 's'}`, tone: 'warning' };
  return null;
}

export const isOpenRepair = (r) => r.status !== 'done';

// Totals for one property (or every property when propertyId is null) for a month
export function rentSummary(data, month, propertyId = null) {
  const tenants = data.tenants.filter((t) => (!propertyId || t.propertyId === propertyId) && owesRentIn(t, month));
  let expected = 0;
  let collected = 0;
  let late = 0;
  let paidCount = 0;
  for (const t of tenants) {
    const r = rentStatus(t, data.payments, month);
    expected += r.rent;
    collected += Math.min(r.paid, r.rent);
    if (r.status === 'late') late++;
    if (r.status === 'paid') paidCount++;
  }
  return { expected, collected, late, paidCount, tenantCount: tenants.length };
}

export const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
];

export const REPAIR_STATUSES = [
  { value: 'open', label: 'Open', tone: 'danger' },
  { value: 'in_progress', label: 'In progress', tone: 'warning' },
  { value: 'done', label: 'Done', tone: 'success' },
];

export const REPAIR_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'online', label: 'Online / app' },
  { value: 'other', label: 'Other' },
];

export const EXPENSE_CATEGORIES = [
  { value: 'repairs', label: 'Repairs' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'taxes', label: 'Property tax' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'mortgage', label: 'Mortgage / loan' },
  { value: 'hoa', label: 'HOA / society fees' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'other', label: 'Other' },
];

export const labelFor = (options, value) => options.find((o) => o.value === value)?.label ?? '';
