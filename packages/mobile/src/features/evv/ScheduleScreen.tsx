import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
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
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import ErrorRetry from '../common/ErrorRetry';
import EmptyState from '../common/EmptyState';
import { SkeletonList } from '../common/Skeleton';
import { colors, typography, radii, shadow, gradients } from '../common/tokens';

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
    : ', ';
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [mode, setMode] = useState<ViewMode>('list');
  const [error, setError] = useState<string | null>(null);
  // Device-clock skew vs the server, forwarded to the clock-in screen so its
  // time-window UX matches the server decision on a badly set phone clock.
  const serverSkewMsRef = useRef(0);

  // Animated segmented control: the active pill slides between the two halves
  // of the measured track instead of the background swapping instantly.
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = useSharedValue(0);
  // Track border (1pt each side) + padding (3pt each side) → two equal halves.
  const pillWidth = trackWidth > 0 ? (trackWidth - 8) / 2 : 0;
  const pillStyle = useAnimatedStyle(() => ({
    width: pillWidth,
    transform: [
      { translateX: withSpring(activeIndex.value * pillWidth, { damping: 18, stiffness: 220 }) },
    ],
  }));

  const selectMode = (next: ViewMode) => {
    if (next === mode) return;
    void Haptics.selectionAsync();
    activeIndex.value = next === 'list' ? 0 : 1;
    setMode(next);
  };

  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState({ year: today.getFullYear(), m: today.getMonth() });
  const [selectedKey, setSelectedKey] = useState(
    keyOf(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const load = useCallback(async () => {
    try {
      let schedule: ScheduleRow[] = [];
      let serverTime: string | undefined;
      try {
        // Preferred: full multi-day window for the calendar.
        const res = await apiClient.get<{ schedule: ScheduleRow[]; serverTime?: string }>('/api/mobile/caregiver/schedule?days=30');
        schedule = res.data?.schedule ?? [];
        serverTime = res.data?.serverTime;
      } catch {
        // The /schedule endpoint may not be deployed yet, fall back to the
        // always-available "today" window (same row shape) so the tab still
        // shows visits instead of an empty state.
        const res = await apiClient.get<{ schedule: ScheduleRow[]; serverTime?: string }>('/api/mobile/caregiver/today');
        schedule = res.data?.schedule ?? [];
        serverTime = res.data?.serverTime;
      }
      const serverNow = serverTime ? Date.parse(serverTime) : NaN;
      if (Number.isFinite(serverNow)) serverSkewMsRef.current = serverNow - Date.now();
      setRows(schedule);
      setError(null);
    } catch {
      // Both /schedule and /today failed → a real connectivity/server problem.
      setRows([]);
      setError('Could not load your schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch on focus so new web-created schedule data appears without a manual pull.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
        ...(r.scheduledEndTime ? { scheduledEndTime: r.scheduledEndTime } : {}),
        serverSkewMs: String(serverSkewMsRef.current),
        ...(r.clientLatitude != null ? { clientLat: String(r.clientLatitude) } : {}),
        ...(r.clientLongitude != null ? { clientLng: String(r.clientLongitude) } : {}),
        clientGeofenceM: String(r.geofenceRadiusM),
        ...(inProgress ? { openVisitId: r.currentVisitId as string } : {}),
        ...(inProgress && r.currentClockInTime ? { clockInTime: r.currentClockInTime } : {}),
      },
    });
  };

  const renderCard = (item: ScheduleRow, index: number) => {
    const address = [item.clientAddressLine1, item.clientCity, item.clientState].filter(Boolean).join(', ');
    const inProgress = item.currentVisitId && !item.currentClockOutTime;
    const completed = !!item.currentClockOutTime;
    return (
      <Animated.View
        key={item.assignmentId}
        entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}
      >
      <Pressable
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
          {address ? (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.addr} numberOfLines={1}>{address}</Text>
            </View>
          ) : null}
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
        <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
      </Pressable>
      </Animated.View>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBlue} />}
    >
      <View style={styles.calCard}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={colors.brandBlue} />
          </Pressable>
          <Text style={styles.monthTitle}>{MONTHS[month.m]} {month.year}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color={colors.brandBlue} />
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
        selectedVisits.map((item, index) => renderCard(item, index))
      ) : (
        <View style={styles.dayEmpty}>
          <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
          <Text style={styles.dayEmptyText}>No visits scheduled</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={gradients.header} style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Schedule</Text>
          <View
            style={styles.toggle}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            {pillWidth > 0 ? <Animated.View style={[styles.togglePill, pillStyle]} /> : null}
            <Pressable
              onPress={() => selectMode('list')}
              style={styles.toggleBtn}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'list' }}
              accessibilityLabel="List view"
            >
              <Ionicons name="list" size={15} color={mode === 'list' ? colors.brandBlue : '#cfe2f5'} />
              <Text style={[styles.toggleText, mode === 'list' && styles.toggleTextActive]}>List</Text>
            </Pressable>
            <Pressable
              onPress={() => selectMode('calendar')}
              style={styles.toggleBtn}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'calendar' }}
              accessibilityLabel="Calendar view"
            >
              <Ionicons name="calendar" size={15} color={mode === 'calendar' ? colors.brandBlue : '#cfe2f5'} />
              <Text style={[styles.toggleText, mode === 'calendar' && styles.toggleTextActive]}>Calendar</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.skeletonPad}>
          <SkeletonList count={5} />
        </View>
      ) : error && rows.length === 0 ? (
        <ErrorRetry message={error} onRetry={load} />
      ) : mode === 'calendar' ? (
        renderCalendar()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.assignmentId}
          renderItem={({ item, index }) => renderCard(item, index)}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandBlue} />}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="Nothing scheduled"
              message="Your upcoming visits will appear here."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...typography.title, color: colors.onGradient },

  toggle: {
    flexDirection: 'row', backgroundColor: '#ffffff1f', borderRadius: radii.pill, padding: 3,
    borderWidth: 1, borderColor: '#ffffff2b',
  },
  togglePill: {
    position: 'absolute', left: 3, top: 3, bottom: 3,
    borderRadius: radii.pill, backgroundColor: colors.cardBg,
  },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    width: 100, paddingVertical: 6, borderRadius: radii.pill,
  },
  toggleText: { fontSize: 12, fontWeight: '800', color: '#cfe2f5' },
  toggleTextActive: { color: colors.brandBlue },

  skeletonPad: { padding: 16 },

  // List
  list: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: 14, marginBottom: 8,
  },

  // Calendar
  calScroll: { padding: 16, paddingBottom: 40 },
  calCard: {
    backgroundColor: colors.cardBg, borderRadius: radii.xl, padding: 14,
    ...shadow.card, marginBottom: 8,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 },
  monthArrow: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0f6fd',
    justifyContent: 'center', alignItems: 'center',
  },
  monthTitle: { ...typography.heading, fontWeight: '900', color: colors.textPrimary },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', ...typography.caption, fontWeight: '800', color: colors.textMuted },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  dayToday: { backgroundColor: '#eaf2fb' },
  daySelected: { backgroundColor: colors.brandBlue },
  dayNum: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  dayDim: { color: '#c2cfdc' },
  dayTodayNum: { color: colors.brandBlue, fontWeight: '900' },
  daySelectedNum: { color: colors.onGradient, fontWeight: '900' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3, backgroundColor: 'transparent' },
  dotOn: { backgroundColor: colors.brandBlue },
  dotOnSelected: { backgroundColor: colors.onGradient },

  dayHeading: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: 10, marginBottom: 10, marginLeft: 2,
  },
  dayEmpty: { backgroundColor: colors.cardBg, borderRadius: radii.md, padding: 20, alignItems: 'center', gap: 8 },
  dayEmptyText: { ...typography.sub, fontWeight: '600', color: colors.textMuted },

  // Visit card (shared)
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 14, marginBottom: 10,
    ...shadow.card,
  },
  timeCol: { width: 64, alignItems: 'center' },
  timeText: { fontSize: 14, fontWeight: '900', color: colors.brandBlue },
  timeEnd: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  infoCol: { flex: 1, gap: 3 },
  clientName: { ...typography.heading, color: colors.textPrimary },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addr: { flex: 1, fontSize: 12, color: colors.textSecondary },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  template: { flex: 1, fontSize: 12, color: colors.textMuted },
  statusTag: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  tagActive: { backgroundColor: '#dcfce7' },
  tagActiveText: { fontSize: 10, fontWeight: '800', color: colors.successDark },
  tagDone: { backgroundColor: '#e2e8f0' },
  tagDoneText: { fontSize: 10, fontWeight: '800', color: '#475569' },
});
