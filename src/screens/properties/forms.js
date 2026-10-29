// Field lists and save/delete behavior for every property-related form
import { todayKey } from '../../dates';
import { currencySymbol } from '../../money';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PROPERTY_TYPES,
  REPAIR_PRIORITIES,
  REPAIR_STATUSES,
  formatMonth,
  monthKey,
  rentStatus,
  shiftMonth,
} from '../../propertyStore';

export function buildForm({ kind, id, propertyId, tenantId, month }, { data, dispatch, settings }) {
  const symbol = currencySymbol(settings.currency);
  const find = (collection) => (id ? data[collection].find((x) => x.id === id) : null);
  const save = (collection, item, values) =>
    item
      ? dispatch({ type: 'UPDATE', collection, id: item.id, changes: values })
      : dispatch({ type: 'ADD', collection, item: values });
  const remover = (collection, item) => (item ? () => dispatch({ type: 'DELETE', collection, id: item.id }) : undefined);

  switch (kind) {
    case 'property': {
      const item = find('properties');
      return {
        title: item ? 'Edit property' : 'New property',
        initial: item ?? { type: 'residential' },
        fields: [
          { key: 'name', label: 'Name', required: true, placeholder: 'e.g. Maple Street House' },
          { key: 'type', label: 'Type', type: 'select', options: PROPERTY_TYPES },
          { key: 'address', label: 'Address', type: 'multiline' },
          { key: 'notes', label: 'Notes', type: 'multiline', placeholder: 'Parking, gate codes, insurance policy number…' },
        ],
        onSave: (v) => save('properties', item, v),
        onDelete: remover('properties', item),
        deleteLabel: 'Delete property',
        deleteMessage: 'This property and all of its tenants, rent payments, repairs and expenses will be permanently deleted.',
      };
    }

    case 'tenant': {
      const item = find('tenants');
      const property = data.properties.find((p) => p.id === (item?.propertyId ?? propertyId));
      const commercial = property?.type === 'commercial';
      return {
        title: item ? 'Edit tenant' : 'New tenant',
        initial: item ?? { dueDay: 1 },
        fields: [
          { key: 'name', label: commercial ? 'Contact name' : 'Name', required: true },
          commercial && { key: 'businessName', label: 'Business name' },
          {
            key: 'unit',
            label: 'Unit',
            placeholder: commercial ? 'e.g. Suite 100, Shop 3' : 'e.g. Unit 2B, Upstairs',
            hint: 'Leave empty if they rent the whole property',
          },
          { key: 'phone', label: 'Phone', type: 'phone' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'rent', label: 'Monthly rent', type: 'money', prefix: symbol },
          { key: 'dueDay', label: 'Rent due on day', type: 'number', hint: 'Day of the month, for example 1 or 5' },
          { key: 'deposit', label: 'Security deposit', type: 'money', prefix: symbol },
          { key: 'leaseStart', label: 'Lease start', type: 'date' },
          { key: 'leaseEnd', label: 'Lease end', type: 'date' },
          { key: 'notes', label: 'Notes', type: 'multiline' },
          item && { key: 'movedOut', label: 'Moved out', type: 'toggle', hint: 'Moved-out tenants no longer appear in rent tracking' },
        ].filter(Boolean),
        onSave: (v) => {
          const dueDay = Math.min(Math.max(Math.round(v.dueDay ?? 1), 1), 31);
          save('tenants', item, item ? { ...v, dueDay } : { ...v, dueDay, propertyId, movedOut: false });
        },
        onDelete: remover('tenants', item),
        deleteLabel: 'Delete tenant',
        deleteMessage: 'This tenant and their rent payment history will be permanently deleted. To keep their history, mark them as moved out instead.',
      };
    }

    case 'payment': {
      const item = find('payments');
      const tenant = data.tenants.find((t) => t.id === (item?.tenantId ?? tenantId));
      const forMonth = item?.month ?? month ?? monthKey();
      const balance = tenant ? rentStatus(tenant, data.payments, forMonth).balance : 0;
      const monthOptions = [-3, -2, -1, 0, 1].map((n) => {
        const m = shiftMonth(forMonth, n);
        return { value: m, label: formatMonth(m) };
      });
      return {
        title: item ? 'Edit payment' : `Payment from ${tenant?.name ?? 'tenant'}`,
        initial: item ?? { amount: balance || tenant?.rent, month: forMonth, date: todayKey(), method: 'bank' },
        fields: [
          { key: 'amount', label: 'Amount', type: 'money', prefix: symbol, required: true },
          { key: 'month', label: 'Rent for', type: 'select', options: monthOptions },
          { key: 'date', label: 'Date received', type: 'date', required: true },
          { key: 'method', label: 'Paid by', type: 'select', options: PAYMENT_METHODS },
          { key: 'note', label: 'Note', placeholder: 'Check number, reference…' },
        ],
        onSave: (v) => save('payments', item, item ? v : { ...v, tenantId }),
        onDelete: remover('payments', item),
        deleteLabel: 'Delete payment',
        deleteMessage: 'This payment will be permanently deleted.',
      };
    }

    case 'repair': {
      const item = find('repairs');
      const vendors = [...data.vendors].sort((a, b) => a.name.localeCompare(b.name));
      return {
        title: item ? 'Edit repair' : 'New repair',
        initial: item ?? { priority: 'normal', status: 'open', reportedOn: todayKey(), vendorId: '' },
        fields: [
          { key: 'title', label: 'What needs fixing', required: true, placeholder: 'e.g. Leaking kitchen tap' },
          { key: 'unit', label: 'Unit', placeholder: 'e.g. Unit 2B' },
          { key: 'status', label: 'Status', type: 'select', options: REPAIR_STATUSES },
          { key: 'priority', label: 'Priority', type: 'select', options: REPAIR_PRIORITIES },
          vendors.length
            ? { key: 'vendorId', label: 'Vendor', type: 'select', options: [{ value: '', label: 'None' }, ...vendors.map((v) => ({ value: v.id, label: v.name }))] }
            : null,
          { key: 'cost', label: 'Cost', type: 'money', prefix: symbol },
          { key: 'reportedOn', label: 'Reported on', type: 'date' },
          { key: 'completedOn', label: 'Completed on', type: 'date', visibleIf: (v) => v.status === 'done' },
          { key: 'description', label: 'Details', type: 'multiline' },
        ].filter(Boolean),
        onSave: (v) => {
          const values = { ...v };
          if (values.status === 'done' && !values.completedOn) values.completedOn = todayKey();
          if (values.status !== 'done') values.completedOn = null;
          save('repairs', item, item ? values : { ...values, propertyId });
        },
        onDelete: remover('repairs', item),
        deleteLabel: 'Delete repair',
        deleteMessage: 'This repair record will be permanently deleted.',
      };
    }

    case 'expense': {
      const item = find('expenses');
      return {
        title: item ? 'Edit expense' : 'New expense',
        initial: item ?? { category: 'repairs', date: todayKey() },
        fields: [
          { key: 'amount', label: 'Amount', type: 'money', prefix: symbol, required: true },
          { key: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES },
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'note', label: 'Note', placeholder: 'e.g. Annual property tax' },
        ],
        onSave: (v) => save('expenses', item, item ? v : { ...v, propertyId }),
        onDelete: remover('expenses', item),
        deleteLabel: 'Delete expense',
        deleteMessage: 'This expense will be permanently deleted.',
      };
    }

    case 'vendor': {
      const item = find('vendors');
      return {
        title: item ? 'Edit vendor' : 'New vendor',
        initial: item ?? {},
        fields: [
          { key: 'name', label: 'Name', required: true, placeholder: 'Person or company' },
          { key: 'trade', label: 'Trade', placeholder: 'Plumber, electrician, cleaner…' },
          { key: 'phone', label: 'Phone', type: 'phone' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'notes', label: 'Notes', type: 'multiline' },
        ],
        onSave: (v) => save('vendors', item, v),
        onDelete: remover('vendors', item),
        deleteLabel: 'Delete vendor',
        deleteMessage: 'This vendor will be removed. Repairs they worked on are kept.',
      };
    }

    default:
      return null;
  }
}
