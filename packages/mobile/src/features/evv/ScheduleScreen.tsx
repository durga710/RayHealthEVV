import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

interface ScheduleRow {
  assignmentId: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientAddressLine1: string | null;
  clientCity: string | null;
  clientState: string | null;
  clientLatitude: number | null;
  clientLongitude: number | null;
  geofenceRadiusM: number;
  templateName: string;
  currentVisitId: string | null;
  currentVisitStatus: string | null;
  currentClockInTime: string | null;
  currentClockOutTime: string | null;
}

interface Section {
  title: string;
  data: ScheduleRow[];
}

type ViewMode = 'list' | 'calendar';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function keyOf(y: number, m: number, d: number): string {
  return `${y}-${m}-${d}`;
}

function dayKey(iso: string | null): string {
  if (!iso) return 'unscheduled';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'unscheduled';
  return keyOf(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayLabel(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'Unscheduled';
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (dayKey(iso) === keyOf(today.getFullYear(), today.getMonth(), today.getDate())) return 'Today';
  if (dayKey(iso) === keyOf(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function dateLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const k = keyOf(date.getFullYear(), date.getMonth(), date.getDate());
  if (k === keyOf(today.getFullYear(), today.getMonth(), today.getDate())) return 'Today';
  if (k === keyOf(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(iso: string | null): string {
  if (!iso) return 'On call';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [mode, setMode] = useState<ViewMode>('list');

  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState({ year: today.getFullYear(), m: today.getMonth() });
  const [selectedKey, setSelectedKey] = useState(
    keyOf(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const load = useCallback(async () => {
    try {
      let schedule: ScheduleRow[] = [];
      try {
        // Preferred: full multi-day window for the calendar.
        const res = await apiClient.get<{ schedule: ScheduleRow[] }>('/api/mobile/caregiver/schedule?days=30');
        schedule = res.data?.schedule ?? [];
      } catch {
        // The /schedule endpoint may not be deployed yet — fall back to the
        // always-available "today" window (same row shape) so the tab still
        // shows visits instead of an empty state.
        const res = await apiClient.get<{ schedule: ScheduleRow[] }>('/api/mobile/caregiver/today');
        schedule = res.data?.schedule ?? [];
      }
      setRows(schedule);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  // Group rows by local day for both the section list and the calendar.
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const r of rows) {
      const k = dayKey(r.scheduledStartTime);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return map;
  }, [rows]);

  const sections = useMemo<Section[]>(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const k = dayKey(r.scheduledStartTime);
      if (!seen.has(k)) {
        seen.add(k);
        order.push(k);
      }
    }
    return order.map((k) => ({
      title: dayLabel(byDay.get(k)![0].scheduledStartTime),
      data: byDay.get(k)!,
    }));
  }, [rows, byDay]);

  const openVisit = (r: ScheduleRow) => {
    const address = [r.clientAddressLine1, r.clientCity, r.clientState].filter(Boolean).join(', ');
    const inProgress = r.currentVisitId && !r.currentClockOutTime;
    router.push({
      pathname: '/clockin',
      params: {
        assignmentId: r.assignmentId,
        clientName: `${r.clientFirstName} ${r.clientLastName}`.trim(),
        ...(address ? { clientAddress: address } : {}),
        ...(r.scheduledStartTime ? { scheduledTime: r.scheduledStartTime } : {}),
        ...(r.clientLatitude != null ? { clientLat: String(r.clientLatitude) } : {}),
        ...(r.clientLongitude != null ? { clientLng: String(r.clientLongitude) } : {}),
        clientGeofenceM: String(r.geofenceRadiusM),
        ...(inProgress ? { openVisitId: r.currentVisitId as string } : {}),
        ...(inProgress && r.currentClockInTime ? { clockInTime: r.currentClockInTime } : {}),
      },
    });
  };

  const renderCard = (item: ScheduleRow) => {
    const address = [item.clientAddressLine1, item.clientCity, item.clientState].filter(Boolean).join(', ');
    const inProgress = item.currentVisitId && !item.currentClockOutTime;
    const completed = !!item.currentClockOutTime;
    return (
      <Pressable
        key={item.assignmentId}
        onPress={() => openVisit(item)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.timeCol}>
          <Text style={styles.timeText}>{formatTime(item.scheduledStartTime)}</Text>
          {item.scheduledEndTime ? <Text style={styles.timeEnd}>{formatTime(item.scheduledEndTime)}</Text> : null}
        </View>
        <View style={styles.divider} />
        <View style={styles.infoCol}>
          <Text style={styles.clientName} numberOfLines={1}>
            {`${item.clientFirstName} ${item.clientLastName}`.trim()}
          </Text>
          {address ? <Text style={styles.addr} numberOfLines={1}>📍 {address}</Text> : null}
          <View style={styles.tagRow}>
            <Text style={styles.template} numberOfLines={1}>{item.templateName}</Text>
            {inProgress ? (
              <View style={[styles.statusTag, styles.tagActive]}>
                <Text style={styles.tagActiveText}>In progress</Text>
              </View>
            ) : completed ? (
              <View style={[styles.statusTag, styles.tagDone]}>
                <Text style={styles.tagDoneText}>Completed</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#bcccdc" />
      </Pressable>
    );
  };

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const grid = useMemo(() => {
    const first = new Date(month.year, month.m, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(month.year, month.m + 1, 0).getDate();
    const weeks = Math.ceil((startWeekday + daysInMonth) / 7);
    const start = new Date(month.year, month.m, 1 - startWeekday);
    const cells: Date[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return cells;
  }, [month]);

  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedVisits = byDay.get(selectedKey) ?? [];
  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedKey.split('-').map(Number);
    return new Date(y, m, d);
  }, [selectedKey]);

  const shiftMonth = (delta: number) => {
    setMonth((prev) => {
      const next = new Date(prev.year, prev.m + delta, 1);
      return { year: next.getFullYear(), m: next.getMonth() };
    });
  };

  const renderCalendar = () => (
    <ScrollView
      contentContainerStyle={styles.calScroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a5fa8" />}
    >
      <View style={styles.calCard}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color="#1a5fa8" />
          </Pressable>
          <Text style={styles.monthTitle}>{MONTHS[month.m]} {month.year}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color="#1a5fa8" />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.weekday}>{w}</Text>
          ))}
        </View>

        <View style={styles.gridWrap}>
          {grid.map((date) => {
            const k = keyOf(date.getFullYear(), date.getMonth(), date.getDate());
            const inMonth = date.getMonth() === month.m;
            const isToday = k === todayKey;
            const isSelected = k === selectedKey;
            const hasVisits = byDay.has(k);
            return (
              <Pressable key={k} style={styles.dayCell} onPress={() => setSelectedKey(k)}>
                <View
                  style={[
                    styles.dayCircle,
                    isToday && !isSelected && styles.dayToday,
                    isSelected && styles.daySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      !inMonth && styles.dayDim,
                      isToday && !isSelected && styles.dayTodayNum,
                      isSelected && styles.daySelectedNum,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                <View style={[styles.dot, hasVisits && (isSelected ? styles.dotOnSelected : styles.dotOn)]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.dayHeading}>{dateLabel(selectedDate)}</Text>
      {selectedVisits.length > 0 ? (
        selectedVisits.map(renderCard)
      ) : (
        <View style={styles.dayEmpty}>
          <Text style={styles.dayEmptyText}>No visits scheduled</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Schedule</Text>
          <View style={styles.toggle}>
            <Pressable
              onPress={() => setMode('list')}
              style={[styles.toggleBtn, mode === 'list' && styles.toggleBtnActive]}
            >
              <Ionicons name="list" size={15} color={mode === 'list' ? '#1a5fa8' : '#cfe2f5'} />
              <Text style={[styles.toggleText, mode === 'list' && styles.toggleTextActive]}>List</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('calendar')}
              style={[styles.toggleBtn, mode === 'calendar' && styles.toggleBtnActive]}
            >
              <Ionicons name="calendar" size={15} color={mode === 'calendar' ? '#1a5fa8' : '#cfe2f5'} />
              <Text style={[styles.toggleText, mode === 'calendar' && styles.toggleTextActive]}>Calendar</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a5fa8" />
        </View>
      ) : mode === 'calendar' ? (
        renderCalendar()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.assignmentId}
          renderItem={({ item }) => renderCard(item)}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a5fa8" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color="#9db3c8" />
              <Text style={styles.emptyTitle}>Nothing scheduled</Text>
              <Text style={styles.emptyNote}>Your upcoming visits will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },

  toggle: {
    flexDirection: 'row', backgroundColor: '#ffffff1f', borderRadius: 999, padding: 3,
    borderWidth: 1, borderColor: '#ffffff2b',
  },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 12, fontWeight: '800', color: '#cfe2f5' },
  toggleTextActive: { color: '#1a5fa8' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // List
  list: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 13, fontWeight: '900', color: '#4a6480',
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8,
  },

  // Calendar
  calScroll: { padding: 16, paddingBottom: 40 },
  calCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 14,
    shadowColor: '#0f2d52', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2, marginBottom: 8,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 },
  monthArrow: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0f6fd',
    justifyContent: 'center', alignItems: 'center',
  },
  monthTitle: { fontSize: 16, fontWeight: '900', color: '#0f2d52' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#9db3c8' },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  dayToday: { backgroundColor: '#eaf2fb' },
  daySelected: { backgroundColor: '#1a5fa8' },
  dayNum: { fontSize: 14, fontWeight: '700', color: '#1a3a5c' },
  dayDim: { color: '#c2cfdc' },
  dayTodayNum: { color: '#1a5fa8', fontWeight: '900' },
  daySelectedNum: { color: '#fff', fontWeight: '900' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3, backgroundColor: 'transparent' },
  dotOn: { backgroundColor: '#1a5fa8' },
  dotOnSelected: { backgroundColor: '#fff' },

  dayHeading: {
    fontSize: 13, fontWeight: '900', color: '#4a6480',
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10, marginBottom: 10, marginLeft: 2,
  },
  dayEmpty: { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center' },
  dayEmptyText: { color: '#8499ad', fontSize: 13, fontWeight: '600' },

  // Visit card (shared)
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: '#0f2d52', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  timeCol: { width: 64, alignItems: 'center' },
  timeText: { fontSize: 14, fontWeight: '900', color: '#1a5fa8' },
  timeEnd: { fontSize: 11, color: '#8499ad', marginTop: 2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: '#eaf0f6' },
  infoCol: { flex: 1, gap: 3 },
  clientName: { fontSize: 15, fontWeight: '800', color: '#0f2d52' },
  addr: { fontSize: 12, color: '#5a7088' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  template: { flex: 1, fontSize: 12, color: '#8499ad' },
  statusTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagActive: { backgroundColor: '#dcfce7' },
  tagActiveText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
  tagDone: { backgroundColor: '#e2e8f0' },
  tagDoneText: { fontSize: 10, fontWeight: '800', color: '#475569' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f2d52', marginTop: 8 },
  emptyNote: { fontSize: 13, color: '#5a7088', textAlign: 'center', lineHeight: 19 },
});
