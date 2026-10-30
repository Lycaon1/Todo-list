import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  DAYS_SHORT,
  MONTHS_LONG,
  addDays,
  formatDate,
  formatTime,
  fromKey,
  plural,
  todayKey,
  toKey,
} from '../../dates';
import {
  EVENT_CATEGORIES,
  categoryIcon,
  describeRepeat,
  milestone,
  nextOccurrence,
  occursOn,
} from '../../calendarStore';
import { findMessageEvents } from '../../messageScan';
import { getSmsPermission, readInbox, requestSmsPermission, smsSupported } from '../../smsInbox';
import { parseEvents, prefersDayFirst } from '../../parseEvents';
import { labelFor } from '../../propertyStore';
import { noOutline, useTheme } from '../../theme';
import { BottomSheet, Dialog, TextButton } from '../../components/Overlays';
import { Button, Card, Chip, Fab, IconButton, Segmented, TopBar } from '../../components/ui';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const UPCOMING_DAYS = 60;
const SMS_DAYS = 30;
const CATEGORY_ORDER = EVENT_CATEGORIES.map((c) => c.value);
const SMS_BLOCKED =
  "Android didn't allow it. Open Settings, then Apps, then Anjali's World. If there's a ⋮ menu at the top, tap it and choose 'Allow restricted settings'. Then go to Permissions, then SMS, and choose Allow.";

const byTime = (a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || (a.time ?? '').localeCompare(b.time ?? '');

function monthCells(month) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const cells = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toKey(new Date(y, m - 1, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  return toKey(new Date(y, m - 1 + n, 1)).slice(0, 7);
}

function AgendaItem({ item, dateKey, onPress }) {
  const theme = useTheme();
  const color = theme.categories[item.category] ?? theme.primary;
  let detail;
  if (item.kind === 'event')
    detail =
      milestone(item.event, dateKey) ??
      (item.event.repeat ? describeRepeat(item.event) : labelFor(EVENT_CATEGORIES, item.category));
  else detail = item.detail;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.pressed }]}>
      <View style={[styles.itemBar, { backgroundColor: color }]} />
      <View style={[styles.itemTime, !!item.when && styles.itemTimeWide]}>
        {!!item.when && <Text style={[styles.itemWhen, { color: theme.primary }]}>{item.when}</Text>}
        <Text style={[styles.itemTimeText, { color: theme.text }]}>
          {item.time ? formatTime(item.time) : 'All day'}
        </Text>
        {!!item.endTime && <Text style={[styles.itemEnd, { color: theme.muted }]}>{formatTime(item.endTime)}</Text>}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
        {!!detail && <Text style={[styles.itemDetail, { color: theme.textSecondary }]}>{detail}</Text>}
      </View>
      <MaterialIcons name={item.icon} size={20} color={color} />
    </Pressable>
  );
}

function DraftCard({ draft, onEdit, onRemove }) {
  const theme = useTheme();
  const color = theme.categories[draft.category] ?? theme.primary;
  const when = draft.time
    ? `${formatTime(draft.time)}${draft.endTime ? ` – ${formatTime(draft.endTime)}` : ''}`
    : 'All day';
  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [
        styles.draft,
        { borderColor: theme.divider },
        pressed && { backgroundColor: theme.pressed },
      ]}
    >
      <MaterialIcons name={categoryIcon(draft.category)} size={22} color={color} />
      <View style={styles.flex}>
        <Text style={[styles.itemTitle, { color: theme.text }]}>{draft.title}</Text>
        <Text style={[styles.itemDetail, { color: theme.textSecondary }]}>
          {describeRepeat(draft)} · {when}
        </Text>
        {!!draft.messageText && (
          <Text numberOfLines={2} style={[styles.draftSource, { color: theme.muted }]}>
            From {draft.messageFrom}: “{draft.messageText}”
          </Text>
        )}
        {draft.missingDate && (
          <View style={styles.draftWarning}>
            <Chip icon="warning" tone="warning" label="No date heard, set to today. Tap to change." />
          </View>
        )}
      </View>
      <IconButton icon="close" label={`Remove ${draft.title}`} size={20} onPress={onRemove} />
    </Pressable>
  );
}

export default function CalendarScreen({
  calendar,
  calendarDispatch,
  tasks,
  properties,
  settings,
  settingsDispatch,
  appOpenedAt,
  nav,
  showMessage,
}) {
  const theme = useTheme();
  const today = todayKey();
  const [view, setView] = useState('month');
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [drafts, setDrafts] = useState(null);
  const [collapsed, setCollapsed] = useState([]);
  const [smsPermission, setSmsPermission] = useState(smsSupported ? 'undetermined' : 'unsupported');
  const [smsFound, setSmsFound] = useState([]);
  const [smsIntro, setSmsIntro] = useState(false);
  const [smsError, setSmsError] = useState(null);

  // ---- Text messages (Android only) ----
  const scanMessages = useCallback(async () => {
    try {
      const messages = await readInbox(Date.now() - SMS_DAYS * 86400000, 300);
      const found = findMessageEvents(messages, {
        seen: new Set(settings.smsSeen),
        dayFirst: prefersDayFirst(),
      });
      setSmsFound(found);
      return found;
    } catch {
      setSmsFound([]);
      return [];
    }
  }, [settings.smsSeen]);

  useEffect(() => {
    if (!smsSupported) return;
    getSmsPermission().then((permission) => {
      setSmsPermission(permission);
      if (permission === 'granted') scanMessages();
    });
  }, [appOpenedAt, scanMessages]);

  const markSeen = (ids) =>
    settingsDispatch({
      type: 'SET',
      changes: { smsSeen: [...ids, ...settings.smsSeen].slice(0, 1000) },
    });

  const reviewMessages = (found) => setDrafts(found.map((d, i) => ({ ...d, draftId: i })));

  const checkMessages = async () => {
    let permission = smsPermission;
    if (permission !== 'granted') {
      permission = await requestSmsPermission();
      setSmsPermission(permission === 'granted' ? 'granted' : 'undetermined');
      if (permission !== 'granted') {
        setSmsError(permission === 'blocked' ? SMS_BLOCKED : "The app can't check your texts without permission.");
        return;
      }
    }
    const found = await scanMessages();
    if (found.length) reviewMessages(found);
    else showMessage('No new dates found in your texts');
  };

  // Task due dates and lease end dates also show on the calendar
  const extras = useMemo(() => {
    const items = tasks.tasks
      .filter((t) => t.due && !t.done)
      .map((t) => ({
        kind: 'task',
        key: `t-${t.id}`,
        id: t.id,
        date: t.due,
        time: t.time,
        title: t.title,
        category: 'task',
        icon: 'task-alt',
        detail: 'Task',
      }));
    for (const tenant of properties.tenants) {
      if (!tenant.leaseEnd || tenant.movedOut) continue;
      const property = properties.properties.find((p) => p.id === tenant.propertyId);
      items.push({
        kind: 'lease',
        key: `l-${tenant.id}`,
        id: tenant.id,
        date: tenant.leaseEnd,
        title: `Lease ends: ${tenant.name}`,
        category: 'lease',
        icon: 'event-busy',
        detail: [property?.name, tenant.unit].filter(Boolean).join(' · '),
      });
    }
    return items;
  }, [tasks, properties]);

  const itemsOn = (key) =>
    [
      ...calendar.events
        .filter((e) => occursOn(e, key))
        .map((e) => ({
          kind: 'event',
          key: e.id,
          event: e,
          title: e.title,
          time: e.time,
          endTime: e.endTime,
          category: e.category,
          icon: categoryIcon(e.category),
        })),
      ...extras.filter((x) => x.date === key),
    ].sort(byTime);

  const open = (item) => {
    if (item.kind === 'event') nav.push('form', { kind: 'event', id: item.event.id });
    else if (item.kind === 'task') nav.push('task', { id: item.id });
    else nav.push('tenant', { id: item.id });
  };

  const understand = () => {
    const found = parseEvents(text, { dayFirst: prefersDayFirst() });
    if (found.length) setDrafts(found.map((d, i) => ({ ...d, draftId: i })));
  };

  const addDrafts = () => {
    calendarDispatch({
      type: 'ADD',
      items: drafts.map(({ draftId, missingDate, source, messageId, messageFrom, messageText, ...event }) => event),
    });
    const messageIds = drafts.filter((d) => d.messageId).map((d) => d.messageId);
    if (messageIds.length) markSeen(messageIds);
    showMessage(`${plural(drafts.length, 'event')} added`);
    setSelected(drafts[0].date >= today ? drafts[0].date : today);
    setMonth((drafts[0].date >= today ? drafts[0].date : today).slice(0, 7));
    setDrafts(null);
    setText('');
  };

  const editDraft = (draft) =>
    nav.push('form', {
      kind: 'event',
      draft,
      onDraftSave: (updated) => setDrafts((list) => list.map((d) => (d.draftId === updated.draftId ? updated : d))),
    });

  const selectedItems = itemsOn(selected);
  const upcoming = [];
  if (view === 'upcoming') {
    for (let i = 0; i < UPCOMING_DAYS; i++) {
      const key = addDays(today, i);
      const items = itemsOn(key);
      if (items.length) upcoming.push({ key, items });
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopBar
        title="Calendar"
        large
        right={
          <TextButton
            label="Today"
            onPress={() => {
              setSelected(today);
              setMonth(today.slice(0, 7));
            }}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.sayCard}>
          <View style={styles.sayRow}>
            <View style={[styles.micCircle, { backgroundColor: theme.primaryContainer }]}>
              <MaterialIcons name="mic" size={22} color={theme.onPrimaryContainer} />
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Say or type what's coming up…"
              placeholderTextColor={theme.muted}
              multiline
              style={[styles.sayInput, { color: theme.text }, noOutline]}
            />
          </View>
          {(focused || !!text) && (
            <Text style={[styles.sayHint, { color: theme.textSecondary }]}>
              Tap the microphone on your keyboard and speak. For example: “Soccer every Tuesday and Thursday at 5pm.
              Mom's birthday is March 3rd. Dentist next Friday at 3:30.”
            </Text>
          )}
          {!!text.trim() && (
            <Button label="Add to calendar" icon="auto-awesome" onPress={understand} style={styles.sayButton} />
          )}
        </Card>

        {smsSupported &&
          (smsPermission === 'granted' && smsFound.length ? (
            <Card style={styles.smsCard}>
              <MaterialIcons name="sms" size={22} color={theme.primary} />
              <Text style={[styles.smsText, { color: theme.text }]}>
                {plural(smsFound.length, 'possible event')} found in your texts
              </Text>
              <Button label="Review" variant="tonal" onPress={() => reviewMessages(smsFound)} />
            </Card>
          ) : smsPermission === 'granted' ? (
            <View style={styles.smsQuiet}>
              <Text style={[styles.smsQuietText, { color: theme.muted }]}>No new dates in your texts</Text>
              <TextButton label="Check again" onPress={checkMessages} />
            </View>
          ) : (
            <Card>
              <View style={styles.smsHead}>
                <MaterialIcons name="sms" size={22} color={theme.primary} />
                <Text style={[styles.smsText, { color: theme.text }]}>Find dates in your texts</Text>
              </View>
              <Text style={[styles.sayHint, { color: theme.textSecondary }]}>
                Check your text messages for appointments, bills and other dates. You approve each one before it's
                added.
              </Text>
              <Button
                label="Check my messages"
                icon="sms"
                variant="tonal"
                onPress={() => setSmsIntro(true)}
                style={styles.sayButton}
              />
            </Card>
          ))}

        <Segmented
          inset={0}
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'categories', label: 'Categories' },
          ]}
        />

        {view === 'categories' &&
          (calendar.events.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>Events you add are grouped here by type.</Text>
          ) : (
            EVENT_CATEGORIES.map((c) => {
              const items = calendar.events
                .filter((e) => (e.category ?? 'event') === c.value)
                .map((e) => ({ event: e, next: nextOccurrence(e, today) }))
                .sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999'));
              if (!items.length) return null;
              const color = theme.categories[c.value] ?? theme.primary;
              const isCollapsed = collapsed.includes(c.value);
              return (
                <View key={c.value} style={styles.upcomingDay}>
                  <Pressable
                    style={styles.groupHeader}
                    onPress={() =>
                      setCollapsed(isCollapsed ? collapsed.filter((x) => x !== c.value) : [...collapsed, c.value])
                    }
                  >
                    <MaterialIcons name={c.icon} size={22} color={color} />
                    <Text style={[styles.groupTitle, { color: theme.text }]}>{c.label}</Text>
                    <Text style={[styles.groupCount, { color: theme.muted }]}>{items.length}</Text>
                    <MaterialIcons
                      name={isCollapsed ? 'expand-more' : 'expand-less'}
                      size={22}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                  {!isCollapsed && (
                    <Card style={styles.listCard}>
                      {items.map(({ event, next }) => (
                        <AgendaItem
                          key={event.id}
                          dateKey={next ?? event.date}
                          onPress={() => nav.push('form', { kind: 'event', id: event.id })}
                          item={{
                            kind: 'event',
                            event,
                            title: event.title,
                            time: event.time,
                            endTime: event.endTime,
                            category: event.category,
                            icon: c.icon,
                            when: next ? formatDate(next) : 'Past',
                          }}
                        />
                      ))}
                    </Card>
                  )}
                </View>
              );
            })
          ))}

        {view === 'categories' ? null : view === 'month' ? (
          <>
            <Card style={styles.monthCard}>
              <View style={styles.monthRow}>
                <IconButton
                  icon="chevron-left"
                  label="Previous month"
                  onPress={() => setMonth(shiftMonth(month, -1))}
                />
                <Text style={[styles.monthLabel, { color: theme.text }]}>
                  {MONTHS_LONG[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
                </Text>
                <IconButton icon="chevron-right" label="Next month" onPress={() => setMonth(shiftMonth(month, 1))} />
              </View>
              <View style={styles.grid}>
                {WEEKDAY_LETTERS.map((d, i) => (
                  <Text key={i} style={[styles.weekday, { color: theme.muted }]}>
                    {d}
                  </Text>
                ))}
                {monthCells(month).map((key, i) => {
                  if (!key) return <View key={i} style={styles.cell} />;
                  const isSelected = key === selected;
                  const isToday = key === today;
                  const dots = itemsOn(key).slice(0, 3);
                  return (
                    <Pressable
                      key={key}
                      style={styles.cell}
                      onPress={() => setSelected(key)}
                      accessibilityLabel={formatDate(key)}
                    >
                      <View
                        style={[
                          styles.day,
                          isSelected && { backgroundColor: theme.primary },
                          !isSelected &&
                            isToday && {
                              borderWidth: 1.5,
                              borderColor: theme.primary,
                            },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSelected ? theme.onPrimary : isToday ? theme.primary : theme.text,
                            fontWeight: isSelected || isToday ? '700' : '400',
                          }}
                        >
                          {fromKey(key).getDate()}
                        </Text>
                      </View>
                      <View style={styles.dots}>
                        {dots.map((item) => (
                          <View
                            key={item.key}
                            style={[
                              styles.dot,
                              {
                                backgroundColor: theme.categories[item.category] ?? theme.primary,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Text style={[styles.dayHeading, { color: theme.text }]}>
              {selected === today ? 'Today' : formatDate(selected)}
              <Text style={[styles.dayHeadingSub, { color: theme.muted }]}>
                {'  '}
                {DAYS_SHORT[fromKey(selected).getDay()]}, {MONTHS_LONG[fromKey(selected).getMonth()]}{' '}
                {fromKey(selected).getDate()}
              </Text>
            </Text>
            {selectedItems.length ? (
              <Card style={styles.listCard}>
                {selectedItems.map((item) => (
                  <AgendaItem key={item.key} item={item} dateKey={selected} onPress={() => open(item)} />
                ))}
              </Card>
            ) : (
              <Text style={[styles.empty, { color: theme.muted }]}>
                Nothing planned. Say it above or tap + to add something.
              </Text>
            )}
          </>
        ) : upcoming.length ? (
          upcoming.map(({ key, items }) => (
            <View key={key} style={styles.upcomingDay}>
              <Text style={[styles.dayHeading, { color: theme.text }]}>{formatDate(key)}</Text>
              <Card style={styles.listCard}>
                {items.map((item) => (
                  <AgendaItem key={item.key} item={item} dateKey={key} onPress={() => open(item)} />
                ))}
              </Card>
            </View>
          ))
        ) : (
          <Text style={[styles.empty, { color: theme.muted }]}>Nothing in the next {UPCOMING_DAYS} days.</Text>
        )}
      </ScrollView>
      <Fab label="Event" onPress={() => nav.push('form', { kind: 'event', date: selected })} />

      {smsIntro && (
        <Dialog
          title="Check your text messages?"
          onClose={() => setSmsIntro(false)}
          actions={
            <>
              <TextButton label="Cancel" onPress={() => setSmsIntro(false)} />
              <TextButton
                label="Continue"
                onPress={() => {
                  setSmsIntro(false);
                  checkMessages();
                }}
              />
            </>
          }
        >
          <Text style={[styles.dialogText, { color: theme.textSecondary }]}>
            The app looks through texts from the last {SMS_DAYS} days for appointments, bills and other dates.
            Everything stays on this phone; nothing is uploaded. Nothing is added until you approve it. Android will ask
            for permission next.
          </Text>
        </Dialog>
      )}
      {smsError && (
        <Dialog
          title="Can't read texts"
          onClose={() => setSmsError(null)}
          actions={<TextButton label="OK" onPress={() => setSmsError(null)} />}
        >
          <Text style={[styles.dialogText, { color: theme.textSecondary }]}>{smsError}</Text>
        </Dialog>
      )}
      {drafts && (
        <BottomSheet onClose={() => setDrafts(null)}>
          <View style={styles.sheet}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {drafts[0].messageId ? 'Found in your texts' : "Here's what I understood"}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
              {drafts[0].messageId
                ? 'Tap ✕ on anything you don’t want, tap an event to fix it, then add.'
                : 'Tap any event to fix it, then add them.'}
            </Text>
            <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent}>
              {[...drafts]
                .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
                .map((d, i, list) => (
                  <View key={d.draftId} style={styles.draftGroup}>
                    {(i === 0 || list[i - 1].category !== d.category) && (
                      <Text
                        style={[
                          styles.groupLabel,
                          {
                            color: theme.categories[d.category] ?? theme.primary,
                          },
                        ]}
                      >
                        {labelFor(EVENT_CATEGORIES, d.category)}
                      </Text>
                    )}
                    <DraftCard
                      key={d.draftId}
                      draft={d}
                      onEdit={() => editDraft(d)}
                      onRemove={() => {
                        if (d.messageId) markSeen([d.messageId]);
                        setDrafts((list) => (list.length > 1 ? list.filter((x) => x.draftId !== d.draftId) : null));
                      }}
                    />
                  </View>
                ))}
            </ScrollView>
            <View style={styles.sheetActions}>
              <TextButton label="Cancel" onPress={() => setDrafts(null)} />
              <Button label={`Add ${plural(drafts.length, 'event')}`} icon="check" onPress={addDrafts} />
            </View>
          </View>
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: 16, paddingTop: 0, paddingBottom: 110, gap: 12 },
  sayCard: { padding: 12 },
  sayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  micCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sayInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 40,
    maxHeight: 160,
    paddingTop: 10,
    paddingBottom: 8,
  },
  sayHint: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  sayButton: { alignSelf: 'flex-end', marginTop: 10 },
  monthCard: { padding: 8 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthLabel: { fontSize: 17, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 6,
  },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: 'center' },
  day: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 3, height: 8, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayHeading: { fontSize: 17, fontWeight: '600', marginTop: 4 },
  dayHeadingSub: { fontSize: 14, fontWeight: '400' },
  empty: { fontSize: 14, paddingVertical: 8 },
  listCard: { padding: 0, overflow: 'hidden' },
  upcomingDay: { gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 14,
  },
  itemBar: {
    width: 4,
    alignSelf: 'stretch',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  itemTime: { width: 64 },
  itemTimeWide: { width: 92 },
  itemTimeText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  itemEnd: { fontSize: 12, fontVariant: ['tabular-nums'] },
  itemTitle: { fontSize: 15, fontWeight: '500' },
  itemDetail: { fontSize: 13, marginTop: 2 },
  sheet: { paddingHorizontal: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '500' },
  sheetSub: { fontSize: 14, marginTop: 2, marginBottom: 8 },
  sheetList: { maxHeight: 380 },
  sheetListContent: { gap: 8, paddingBottom: 4 },
  draft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    paddingVertical: 8,
  },
  draftWarning: { marginTop: 6 },
  draftSource: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  draftGroup: { gap: 6 },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  groupTitle: { flex: 1, fontSize: 17, fontWeight: '600' },
  groupCount: { fontSize: 14, fontVariant: ['tabular-nums'] },
  itemWhen: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  smsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  smsHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smsText: { flex: 1, fontSize: 15, fontWeight: '500' },
  smsQuiet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smsQuietText: { fontSize: 13 },
  dialogText: { fontSize: 14, lineHeight: 20 },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
});
