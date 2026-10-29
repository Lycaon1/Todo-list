import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { plural } from '../../dates';
import { formatMoney } from '../../money';
import { PROPERTY_TYPES, formatMonth, isOpenRepair, labelFor, leaseAlert, monthKey, rentSummary } from '../../propertyStore';
import { useTheme } from '../../theme';
import { Button, Card, Chip, EmptyState, Fab, IconButton, ProgressBar, Segmented, TopBar } from '../../components/ui';

function PropertyCard({ property, data, onPress }) {
  const theme = useTheme();
  const tenants = data.tenants.filter((t) => t.propertyId === property.id && !t.movedOut);
  const rent = rentSummary(data, monthKey(), property.id);
  const repairs = data.repairs.filter((r) => r.propertyId === property.id && isOpenRepair(r)).length;
  const leaseAlerts = tenants.filter(leaseAlert).length;
  let rentTone = 'neutral';
  if (rent.late) rentTone = 'danger';
  else if (rent.paidCount === rent.tenantCount) rentTone = 'success';

  return (
    <Card onPress={onPress}>
      <View style={styles.cardHead}>
        <View style={[styles.avatar, { backgroundColor: theme.primaryContainer }]}>
          <MaterialIcons name={property.type === 'commercial' ? 'store' : 'home'} size={22} color={theme.onPrimaryContainer} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
            {property.name}
          </Text>
          {!!property.address && (
            <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {property.address.replace(/\n/g, ', ')}
            </Text>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color={theme.muted} />
      </View>
      <View style={styles.chips}>
        <Chip label={labelFor(PROPERTY_TYPES, property.type)} />
        <Chip icon="person" label={plural(tenants.length, 'tenant')} />
        {rent.tenantCount > 0 && <Chip icon="payments" tone={rentTone} label={`${rent.paidCount}/${rent.tenantCount} paid`} />}
        {repairs > 0 && <Chip icon="handyman" tone="warning" label={plural(repairs, 'repair')} />}
        {leaseAlerts > 0 && <Chip icon="event-busy" tone="warning" label={plural(leaseAlerts, 'lease') + ' ending'} />}
      </View>
    </Card>
  );
}

export default function PropertiesHome({ data, settings, nav }) {
  const theme = useTheme();
  const [filter, setFilter] = useState('all');
  const month = monthKey();
  const money = (n) => formatMoney(n, settings.currency);
  const summary = rentSummary(data, month);
  const openRepairs = data.repairs.filter(isOpenRepair).length;
  const endingLeases = data.tenants.filter(leaseAlert).length;
  const addProperty = () => nav.push('form', { kind: 'property' });

  const count = (type) => data.properties.filter((p) => p.type === type).length;
  const shown = data.properties
    .filter((p) => filter === 'all' || p.type === filter)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopBar
        title="Properties"
        large
        right={<IconButton icon="engineering" label="Vendors" onPress={() => nav.push('vendors')} />}
      />

      {data.properties.length === 0 ? (
        <EmptyState
          icon="apartment"
          title="No properties yet"
          body="Add a property to keep track of its tenants, rent, repairs and expenses."
          action={<Button label="Add property" icon="add" onPress={addProperty} />}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Card>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Rent for {formatMonth(month)}</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {money(summary.collected)}
                <Text style={[styles.summaryOf, { color: theme.textSecondary }]}> of {money(summary.expected)} collected</Text>
              </Text>
              <ProgressBar value={summary.expected ? summary.collected / summary.expected : 0} tone="success" />
              <View style={styles.chips}>
                {summary.late > 0 && <Chip icon="warning" tone="danger" label={`${summary.late} late`} />}
                <Chip icon="handyman" tone={openRepairs ? 'warning' : 'neutral'} label={plural(openRepairs, 'open repair')} />
                {endingLeases > 0 && <Chip icon="event-busy" tone="warning" label={plural(endingLeases, 'lease') + ' ending soon'} />}
              </View>
            </Card>

            <Segmented
              inset={0}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: data.properties.length },
                { value: 'residential', label: 'Residential', count: count('residential') },
                { value: 'commercial', label: 'Commercial', count: count('commercial') },
              ]}
            />

            {shown.map((p) => (
              <PropertyCard key={p.id} property={p} data={data} onPress={() => nav.push('property', { id: p.id })} />
            ))}
          </ScrollView>
          <Fab label="Add property" onPress={addProperty} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 16, paddingBottom: 100, gap: 12 },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryValue: { fontSize: 26, fontWeight: '500', marginTop: 4, marginBottom: 10 },
  summaryOf: { fontSize: 14, fontWeight: '400' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '500' },
  cardSub: { fontSize: 13, marginTop: 2 },
});
