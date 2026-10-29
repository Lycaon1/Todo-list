import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatLongDate } from '../../dates';
import { formatMoney } from '../../money';
import { PAYMENT_METHODS, RENT_STATUS, formatMonth, labelFor, leaseAlert, monthKey, ordinal, owesRentIn, rentStatus } from '../../propertyStore';
import { useTheme } from '../../theme';
import { Button, Card, Chip, IconButton, InfoRow, SectionHeader, TopBar } from '../../components/ui';

const open = (url) => Linking.openURL(url).catch(() => {});

export default function TenantDetail({ id, data, settings, nav }) {
  const theme = useTheme();
  const tenant = data.tenants.find((t) => t.id === id);
  if (!tenant) return null;

  const property = data.properties.find((p) => p.id === tenant.propertyId);
  const money = (n) => formatMoney(n, settings.currency);
  const month = monthKey();
  const status = owesRentIn(tenant, month) ? RENT_STATUS[rentStatus(tenant, data.payments, month).status] : null;
  const alert = leaseAlert(tenant);
  const payments = data.payments
    .filter((p) => p.tenantId === id)
    .sort((a, b) => b.month.localeCompare(a.month) || (b.date ?? '').localeCompare(a.date ?? ''));
  const lease = [tenant.leaseStart && formatLongDate(tenant.leaseStart), tenant.leaseEnd && formatLongDate(tenant.leaseEnd)];

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopBar
        title={tenant.name}
        onBack={nav.pop}
        right={<IconButton icon="edit" label="Edit tenant" onPress={() => nav.push('form', { kind: 'tenant', id })} />}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          {!!tenant.businessName && <Text style={[styles.business, { color: theme.text }]}>{tenant.businessName}</Text>}
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            {[property?.name, tenant.unit].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.chips}>
            {tenant.movedOut && <Chip label="Moved out" />}
            {status && <Chip tone={status.tone} label={`${formatMonth(month)}: ${status.label}`} />}
            {alert && <Chip icon="event-busy" tone={alert.tone} label={alert.text} />}
          </View>
          {(tenant.phone || tenant.email) && (
            <View style={styles.actions}>
              {!!tenant.phone && <Button label="Call" icon="phone" variant="tonal" onPress={() => open(`tel:${tenant.phone}`)} />}
              {!!tenant.phone && <Button label="Text" icon="sms" variant="tonal" onPress={() => open(`sms:${tenant.phone}`)} />}
              {!!tenant.email && <Button label="Email" icon="email" variant="tonal" onPress={() => open(`mailto:${tenant.email}`)} />}
            </View>
          )}
        </Card>

        <Card>
          {Number(tenant.rent) > 0 && (
            <InfoRow icon="payments" label="Rent" value={`${money(tenant.rent)} per month, due on the ${ordinal(Number(tenant.dueDay) || 1)}`} />
          )}
          {Number(tenant.deposit) > 0 && <InfoRow icon="savings" label="Security deposit" value={money(tenant.deposit)} />}
          {(lease[0] || lease[1]) && (
            <InfoRow
              icon="event"
              label="Lease"
              value={lease[0] && lease[1] ? `${lease[0]} – ${lease[1]}` : lease[0] ? `Started ${lease[0]}` : `Ends ${lease[1]}`}
            />
          )}
          {!!tenant.phone && <InfoRow icon="phone" label="Phone" value={tenant.phone} onPress={() => open(`tel:${tenant.phone}`)} />}
          {!!tenant.email && <InfoRow icon="email" label="Email" value={tenant.email} onPress={() => open(`mailto:${tenant.email}`)} />}
          {!!tenant.notes && <InfoRow icon="description" label="Notes" value={tenant.notes} />}
        </Card>

        <SectionHeader
          title="Rent payments"
          right={!tenant.movedOut && <Button label="Record payment" icon="add" variant="tonal" onPress={() => nav.push('form', { kind: 'payment', tenantId: id, month })} />}
        />
        {payments.length === 0 ? (
          <Text style={[styles.sub, { color: theme.muted }]}>No payments recorded yet.</Text>
        ) : (
          <Card style={styles.listCard}>
            {payments.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => nav.push('form', { kind: 'payment', id: p.id })}
                style={({ pressed }) => [
                  styles.paymentRow,
                  i > 0 && { borderTopWidth: 1, borderTopColor: theme.divider },
                  pressed && { backgroundColor: theme.pressed },
                ]}
              >
                <View style={styles.flex}>
                  <Text style={[styles.paymentMonth, { color: theme.text }]}>{formatMonth(p.month)}</Text>
                  <Text style={[styles.meta, { color: theme.muted }]}>
                    {p.date ? formatLongDate(p.date) : ''}
                    {p.method ? ` · ${labelFor(PAYMENT_METHODS, p.method)}` : ''}
                    {p.note ? ` · ${p.note}` : ''}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: theme.text }]}>{money(p.amount)}</Text>
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 48, gap: 12 },
  business: { fontSize: 17, fontWeight: '500' },
  sub: { fontSize: 14, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  listCard: { padding: 0, overflow: 'hidden' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  paymentMonth: { fontSize: 15 },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
