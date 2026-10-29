import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate, formatLongDate } from '../../dates';
import { formatMoney } from '../../money';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PROPERTY_TYPES,
  RENT_STATUS,
  REPAIR_STATUSES,
  formatMonth,
  isOpenRepair,
  labelFor,
  leaseAlert,
  monthKey,
  ordinal,
  owesRentIn,
  rentStatus,
  rentSummary,
  shiftMonth,
} from '../../propertyStore';
import { useTheme } from '../../theme';
import { Button, Card, Chip, EmptyState, Fab, IconButton, InfoRow, ProgressBar, Segmented, TopBar } from '../../components/ui';

function Collapsible({ title, open, onToggle }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onToggle} style={styles.collapsible}>
      <Text style={[styles.collapsibleText, { color: theme.textSecondary }]}>{title}</Text>
      <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={theme.textSecondary} />
    </Pressable>
  );
}

function TenantCard({ tenant, data, money, onPress }) {
  const theme = useTheme();
  const month = monthKey();
  const alert = leaseAlert(tenant);
  const owes = owesRentIn(tenant, month);
  const status = owes ? RENT_STATUS[rentStatus(tenant, data.payments, month).status] : null;
  return (
    <Card onPress={onPress}>
      <View style={styles.rowTop}>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: tenant.movedOut ? theme.muted : theme.text }]}>{tenant.name}</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            {[tenant.businessName, tenant.unit].filter(Boolean).join(' · ') || 'Whole property'}
          </Text>
          {Number(tenant.rent) > 0 && (
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              {money(tenant.rent)}/month · due on the {ordinal(Number(tenant.dueDay) || 1)}
            </Text>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color={theme.muted} />
      </View>
      <View style={styles.chips}>
        {tenant.movedOut && <Chip label="Moved out" />}
        {status && <Chip tone={status.tone} label={`${formatMonth(month).split(' ')[0]}: ${status.label}`} />}
        {alert && <Chip icon="event-busy" tone={alert.tone} label={alert.text} />}
      </View>
    </Card>
  );
}

function RentTab({ property, data, money, nav }) {
  const theme = useTheme();
  const [month, setMonth] = useState(monthKey());
  const tenants = data.tenants.filter((t) => t.propertyId === property.id && owesRentIn(t, month));
  const summary = rentSummary(data, month, property.id);

  return (
    <View style={styles.tabBody}>
      <View style={styles.monthRow}>
        <IconButton icon="chevron-left" label="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} />
        <Text style={[styles.monthText, { color: theme.text }]}>{formatMonth(month)}</Text>
        <IconButton icon="chevron-right" label="Next month" onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>

      {tenants.length === 0 ? (
        <EmptyState icon="payments" title="No rent due this month" body="Tenants with a monthly rent appear here so you can record their payments." />
      ) : (
        <>
          <Card>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              {money(summary.collected)} of {money(summary.expected)} collected
            </Text>
            <View style={styles.progress}>
              <ProgressBar value={summary.expected ? summary.collected / summary.expected : 0} tone="success" />
            </View>
          </Card>
          {tenants.map((t) => {
            const r = rentStatus(t, data.payments, month);
            const s = RENT_STATUS[r.status];
            const payments = data.payments.filter((p) => p.tenantId === t.id && p.month === month);
            return (
              <Card key={t.id}>
                <View style={styles.rowTop}>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{t.name}</Text>
                    <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                      {t.unit ? `${t.unit} · ` : ''}
                      {money(r.paid)} of {money(r.rent)} · due on the {ordinal(Number(t.dueDay) || 1)}
                    </Text>
                  </View>
                  <Chip tone={s.tone} label={s.label} />
                </View>
                {payments.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => nav.push('form', { kind: 'payment', id: p.id })}
                    style={({ pressed }) => [styles.paymentLine, pressed && { backgroundColor: theme.pressed }]}
                  >
                    <MaterialIcons name="check-circle" size={18} color={theme.success} />
                    <Text style={[styles.paymentText, { color: theme.textSecondary }]}>
                      {formatDate(p.date)} · {labelFor(PAYMENT_METHODS, p.method) || 'Payment'}
                    </Text>
                    <Text style={[styles.paymentAmount, { color: theme.text }]}>{money(p.amount)}</Text>
                  </Pressable>
                ))}
                {r.balance > 0 && (
                  <Button
                    label={payments.length ? `Record remaining ${money(r.balance)}` : 'Record payment'}
                    icon="add"
                    variant="tonal"
                    style={styles.cardButton}
                    onPress={() => nav.push('form', { kind: 'payment', tenantId: t.id, month })}
                  />
                )}
              </Card>
            );
          })}
        </>
      )}
    </View>
  );
}

function RepairCard({ repair, data, money, onPress }) {
  const theme = useTheme();
  const status = REPAIR_STATUSES.find((s) => s.value === repair.status) ?? REPAIR_STATUSES[0];
  const vendor = data.vendors.find((v) => v.id === repair.vendorId);
  const details = [repair.unit, vendor?.name, Number(repair.cost) > 0 ? money(repair.cost) : null].filter(Boolean).join(' · ');
  const date = repair.status === 'done' && repair.completedOn ? `Fixed ${formatLongDate(repair.completedOn)}` : repair.reportedOn ? `Reported ${formatLongDate(repair.reportedOn)}` : null;
  return (
    <Card onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={[styles.cardTitle, styles.flex, { color: theme.text }]}>{repair.title}</Text>
        <Chip tone={status.tone} label={status.label} />
      </View>
      {!!details && <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{details}</Text>}
      <View style={styles.chips}>
        {repair.priority === 'urgent' && repair.status !== 'done' && <Chip icon="warning" tone="danger" label="Urgent" />}
        {!!date && <Text style={[styles.meta, { color: theme.muted }]}>{date}</Text>}
      </View>
    </Card>
  );
}

export default function PropertyDetail({ id, data, settings, nav }) {
  const theme = useTheme();
  const [tab, setTab] = useState('tenants');
  const [showPast, setShowPast] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const property = data.properties.find((p) => p.id === id);
  if (!property) return null;

  const money = (n) => formatMoney(n, settings.currency);
  const tenants = data.tenants.filter((t) => t.propertyId === id);
  const current = tenants.filter((t) => !t.movedOut).sort((a, b) => (a.unit ?? '').localeCompare(b.unit ?? '') || a.name.localeCompare(b.name));
  const past = tenants.filter((t) => t.movedOut);
  const repairs = data.repairs.filter((r) => r.propertyId === id);
  const rank = { urgent: 0, normal: 1, low: 2 };
  const openRepairs = repairs
    .filter(isOpenRepair)
    .sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || (b.reportedOn ?? '').localeCompare(a.reportedOn ?? ''));
  const doneRepairs = repairs.filter((r) => !isOpenRepair(r)).sort((a, b) => (b.completedOn ?? '').localeCompare(a.completedOn ?? ''));
  const expenses = data.expenses.filter((e) => e.propertyId === id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const year = String(new Date().getFullYear());
  const yearTotal = expenses.filter((e) => e.date?.startsWith(year)).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const fab = {
    tenants: { label: 'Add tenant', onPress: () => nav.push('form', { kind: 'tenant', propertyId: id }) },
    repairs: { label: 'Add repair', onPress: () => nav.push('form', { kind: 'repair', propertyId: id }) },
    expenses: { label: 'Add expense', onPress: () => nav.push('form', { kind: 'expense', propertyId: id }) },
  }[tab];

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopBar
        title={property.name}
        onBack={nav.pop}
        right={<IconButton icon="edit" label="Edit property" onPress={() => nav.push('form', { kind: 'property', id })} />}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.chipsTight}>
            <Chip icon={property.type === 'commercial' ? 'store' : 'home'} tone="primary" label={labelFor(PROPERTY_TYPES, property.type)} />
          </View>
          {!!property.address && <InfoRow icon="location-on" label="Address" value={property.address} />}
          {!!property.notes && <InfoRow icon="description" label="Notes" value={property.notes} />}
        </View>

        <Segmented
          inset={0}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tenants', label: 'Tenants', count: current.length || undefined },
            { value: 'rent', label: 'Rent' },
            { value: 'repairs', label: 'Repairs', count: openRepairs.length || undefined },
            { value: 'expenses', label: 'Expenses' },
          ]}
        />

        {tab === 'tenants' && (
          <View style={styles.tabBody}>
            {current.length === 0 && (
              <EmptyState icon="person" title="No tenants yet" body="Add the people or businesses renting this property." />
            )}
            {current.map((t) => (
              <TenantCard key={t.id} tenant={t} data={data} money={money} onPress={() => nav.push('tenant', { id: t.id })} />
            ))}
            {past.length > 0 && (
              <Collapsible title={`Past tenants (${past.length})`} open={showPast} onToggle={() => setShowPast(!showPast)} />
            )}
            {showPast &&
              past.map((t) => (
                <TenantCard key={t.id} tenant={t} data={data} money={money} onPress={() => nav.push('tenant', { id: t.id })} />
              ))}
          </View>
        )}

        {tab === 'rent' && <RentTab property={property} data={data} money={money} nav={nav} />}

        {tab === 'repairs' && (
          <View style={styles.tabBody}>
            {openRepairs.length === 0 && (
              <EmptyState
                icon="handyman"
                title={doneRepairs.length ? 'No open repairs' : 'No repairs logged'}
                body="Log maintenance requests here and track them until they're fixed."
              />
            )}
            {openRepairs.map((r) => (
              <RepairCard key={r.id} repair={r} data={data} money={money} onPress={() => nav.push('form', { kind: 'repair', id: r.id })} />
            ))}
            {doneRepairs.length > 0 && (
              <Collapsible title={`Completed (${doneRepairs.length})`} open={showDone} onToggle={() => setShowDone(!showDone)} />
            )}
            {showDone &&
              doneRepairs.map((r) => (
                <RepairCard key={r.id} repair={r} data={data} money={money} onPress={() => nav.push('form', { kind: 'repair', id: r.id })} />
              ))}
          </View>
        )}

        {tab === 'expenses' && (
          <View style={styles.tabBody}>
            {expenses.length === 0 ? (
              <EmptyState icon="receipt-long" title="No expenses yet" body="Record taxes, insurance, utilities and other costs for this property." />
            ) : (
              <>
                <Card>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Spent in {year}</Text>
                  <Text style={[styles.total, { color: theme.text }]}>{money(yearTotal)}</Text>
                </Card>
                <Card style={styles.listCard}>
                  {expenses.map((e, i) => (
                    <Pressable
                      key={e.id}
                      onPress={() => nav.push('form', { kind: 'expense', id: e.id })}
                      style={({ pressed }) => [
                        styles.expenseRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: theme.divider },
                        pressed && { backgroundColor: theme.pressed },
                      ]}
                    >
                      <View style={styles.flex}>
                        <Text style={[styles.expenseTitle, { color: theme.text }]}>{e.note || labelFor(EXPENSE_CATEGORIES, e.category)}</Text>
                        <Text style={[styles.meta, { color: theme.muted }]}>
                          {labelFor(EXPENSE_CATEGORIES, e.category)} · {e.date ? formatLongDate(e.date) : ''}
                        </Text>
                      </View>
                      <Text style={[styles.paymentAmount, { color: theme.text }]}>{money(e.amount)}</Text>
                    </Pressable>
                  ))}
                </Card>
              </>
            )}
          </View>
        )}
      </ScrollView>
      {fab && <Fab label={fab.label} onPress={fab.onPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 110, gap: 12 },
  header: { gap: 4 },
  chipsTight: { flexDirection: 'row', marginBottom: 4 },
  tabBody: { gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '500' },
  cardSub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  meta: { fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  collapsible: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 4 },
  collapsibleText: { fontSize: 14, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthText: { fontSize: 17, fontWeight: '500' },
  progress: { marginTop: 8 },
  paymentLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginTop: 6, borderRadius: 8 },
  paymentText: { flex: 1, fontSize: 13 },
  paymentAmount: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  cardButton: { marginTop: 10, alignSelf: 'flex-start' },
  total: { fontSize: 24, fontWeight: '500', marginTop: 2, fontVariant: ['tabular-nums'] },
  listCard: { padding: 0, overflow: 'hidden' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  expenseTitle: { fontSize: 15 },
});
