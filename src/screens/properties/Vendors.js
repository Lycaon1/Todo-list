import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { plural } from '../../dates';
import { isOpenRepair } from '../../propertyStore';
import { useTheme } from '../../theme';
import { Card, EmptyState, Fab, IconButton, TopBar } from '../../components/ui';

export default function Vendors({ data, nav }) {
  const theme = useTheme();
  const vendors = [...data.vendors].sort((a, b) => a.name.localeCompare(b.name));
  const addVendor = () => nav.push('form', { kind: 'vendor' });

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopBar title="Vendors" onBack={nav.pop} />
      {vendors.length === 0 ? (
        <EmptyState
          icon="engineering"
          title="No vendors yet"
          body="Save the plumbers, electricians, cleaners and other people you call for repairs, then assign them to repairs."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {vendors.map((v) => {
            const open = data.repairs.filter((r) => r.vendorId === v.id && isOpenRepair(r)).length;
            const details = [v.trade, v.phone, open ? plural(open, 'open repair') : null].filter(Boolean).join(' · ');
            return (
              <Card key={v.id} onPress={() => nav.push('form', { kind: 'vendor', id: v.id })}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={[styles.name, { color: theme.text }]}>{v.name}</Text>
                    {!!details && <Text style={[styles.sub, { color: theme.textSecondary }]}>{details}</Text>}
                  </View>
                  {!!v.phone && (
                    <IconButton icon="phone" label={`Call ${v.name}`} color={theme.primary} onPress={() => Linking.openURL(`tel:${v.phone}`).catch(() => {})} />
                  )}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}
      <Fab label="Add vendor" onPress={addVendor} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 100, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '500' },
  sub: { fontSize: 13, marginTop: 2 },
});
