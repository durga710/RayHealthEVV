import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import { ensureNotificationPermission } from '../../lib/notification-permissions';
import { fireDevTestShiftAlert, scheduleShiftAlerts } from '../../lib/shift-alert-scheduler';
import { deriveVisitState, type VisitState } from '../../lib/visit-state';

interface Assignment {
  id: string;
  clientName: string;
  time?: string;
  serviceCode?: string;
  clientLat?: number | null;
  clientLng?: number | null;
  clientGeofenceM?: number;
  visitState: VisitState;
  openVisitId?: string | null;
  clockInTime?: string | null;
}

/** Subset of the /api/mobile/caregiver/today schedule row we render here. */
interface TodayScheduleRow {
  assignmentId: string;
  scheduledStartTime: string | null;
  clientFirstName: string;
  clientLastName: string;
  clientLatitude: number | null;
  clientLongitude: number | null;
  geofenceRadiusM: number;
  currentVisitId: string | null;
  currentVisitStatus: string | null;
  currentClockInTime: string | null;
  currentClockOutTime: string | null;
}

const FOREGROUND_FIRE_WINDOW_MS = 32_000;
const FOREGROUND_FIRE_MIN_MS = 28_000;
const FOREGROUND_TICK_MS = 5_000;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return 'Time TBD';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'Time TBD';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getVisitStatus(iso: string | undefined): 'upcoming' | 'now' | 'past' {
  if (!iso) return 'upcoming';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'upcoming';
  const now = Date.now();
  const diff = t - now;
  if (diff < -3_600_000) return 'past';
  if (Math.abs(diff) < 1_800_000) return 'now';
  return 'upcoming';
}

function greetingFor(user: { firstName?: string | null } | null): string {
  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return user?.firstName ? `${timeGreet}, ${user.firstName}!` : timeGreet;
}

function AdminScreen({ role, onLogout }: { role: string; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={styles.adminGradient}>
        <View style={[styles.adminWrap, { paddingTop: insets.top + 16 }]}>
          <View style={styles.adminIconCircle}>
            <Text style={styles.adminEmoji}>🖥️</Text>
          </View>
          <Text style={styles.adminTitle}>
            {role === 'admin' ? 'Admin Portal' : 'Coordinator Portal'}
          </Text>
          <Text style={styles.adminBody}>
            The mobile app is for caregivers. Use the web portal to manage schedules, review visits,
            and configure your agency.
          </Text>
          <View style={styles.adminUrlCard}>
            <Text style={styles.adminUrlLabel}>Web Portal</Text>
            <Text style={styles.adminUrl}>rayhealthevv.com</Text>
          </View>
          <Pressable
            onPress={onLogout}
            style={({ pressed }) => [styles.logoutCardBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Text style={styles.logoutCardBtnText}>Log out</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

function EmptyVisits() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Text style={styles.emptyEmoji}>📋</Text>
      </View>
      <Text style={styles.emptyTitle}>No visits today</Text>
      <Text style={styles.emptyBody}>Your assigned visits will appear here once scheduled.</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firedForegroundRef = useRef<Set<string>>(new Set());

  const fetchAssignments = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      // Purpose-built mobile endpoint: TODAY's window (12h back / 24h forward)
      // with the scheduled start time the shift-alert scheduler needs. The old
      // /assignments/caregiver returned every assignment with no time, so the
      // "Today's Visits" screen was neither scoped to today nor able to alert.
      const { data } = await apiClient.get('/api/mobile/caregiver/today');
      const rows: TodayScheduleRow[] = data?.schedule ?? [];
      const list: Assignment[] = rows.map((r) => ({
        id: r.assignmentId,
        clientName: `${r.clientFirstName ?? ''} ${r.clientLastName ?? ''}`.trim() || 'Client',
        time: r.scheduledStartTime ?? undefined,
        // serviceCode is re-derived server-side at clock-in; not needed here.
        serviceCode: undefined,
        clientLat: r.clientLatitude ?? null,
        clientLng: r.clientLongitude ?? null,
        clientGeofenceM: r.geofenceRadiusM ?? 150,
        visitState: deriveVisitState(r),
        openVisitId: r.currentVisitId ?? null,
        clockInTime: r.currentClockInTime ?? null,
      }));
      setAssignments(list);
      const permStatus = await ensureNotificationPermission();
      if (permStatus === 'granted') {
        await scheduleShiftAlerts(list);
      }
    } catch {
      // 401 handled centrally; other errors leave the list empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void fetchAssignments(); }, []);

  useEffect(() => {
    if (assignments.length === 0) return;
    const tick = () => {
      const now = Date.now();
      const today = dayKey(new Date(now));
      for (const a of assignments) {
        if (!a.time) continue;
        const shiftStart = new Date(a.time).getTime();
        if (!Number.isFinite(shiftStart)) continue;
        const delta = shiftStart - now;
        if (delta < FOREGROUND_FIRE_MIN_MS || delta > FOREGROUND_FIRE_WINDOW_MS) continue;
        const key = `${a.id}-${today}`;
        if (firedForegroundRef.current.has(key)) continue;
        firedForegroundRef.current.add(key);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    };
    tick();
    const handle = setInterval(tick, FOREGROUND_TICK_MS);
    return () => clearInterval(handle);
  }, [assignments]);

  const handleLogout = () => {
    void logout().finally(() => router.replace('/login'));
  };

  if (user?.role === 'admin' || user?.role === 'coordinator') {
    return <AdminScreen role={user.role} onLogout={handleLogout} />;
  }

  const handleSessionPillLongPress = () => {
    if (!__DEV__) return;
    void fireDevTestShiftAlert();
  };

  const todayStr = new Date().toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const nowCount = assignments.filter(a => getVisitStatus(a.time) === 'now').length;
  const upcomingCount = assignments.filter(a => getVisitStatus(a.time) === 'upcoming').length;

  const renderItem = ({ item }: { item: Assignment }) => {
    const status = getVisitStatus(item.time);
    const hasGeolock = item.clientLat != null && item.clientLng != null;
    const isNow = status === 'now';
    const isPast = status === 'past';

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
        onPress={() =>
          router.push({
            pathname: '/clockin',
            params: {
              assignmentId: item.id,
              clientName: item.clientName,
              scheduledTime: item.time ?? '',
              serviceCode: item.serviceCode ?? '',
              clientLat: item.clientLat != null ? String(item.clientLat) : '',
              clientLng: item.clientLng != null ? String(item.clientLng) : '',
              clientGeofenceM: item.clientGeofenceM != null ? String(item.clientGeofenceM) : '150',
              // Resume an in-progress visit when one is open.
              openVisitId: item.openVisitId ?? '',
              clockInTime: item.clockInTime ?? '',
            },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Visit with ${item.clientName}, tap to open`}
      >
        {isNow ? (
          <LinearGradient
            colors={['#fff7ed', '#fff']}
            style={styles.cardInner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <CardContent item={item} status={status} hasGeolock={hasGeolock} />
          </LinearGradient>
        ) : (
          <View style={[styles.cardInner, isPast && styles.cardInnerPast]}>
            <CardContent item={item} status={status} hasGeolock={hasGeolock} />
          </View>
        )}
        <View style={[
          styles.cardStripe,
          isNow ? styles.stripeNow : isPast ? styles.stripePast : styles.stripeUpcoming,
        ]} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* Header */}
      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Pressable
            onLongPress={handleSessionPillLongPress}
            delayLongPress={600}
            style={styles.sessionPill}
            accessibilityRole="text"
          >
            <View style={styles.sessionDot} />
            <Text style={styles.sessionPillText}>Secure Session</Text>
          </Pressable>
          <Pressable
            onPress={handleLogout}
            hitSlop={12}
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
        <Text style={styles.greeting}>{greetingFor(user)}</Text>
        <Text style={styles.dateLabel}>{todayStr}</Text>

        {assignments.length > 0 && (
          <View style={styles.statsRow}>
            {nowCount > 0 && (
              <View style={styles.statChip}>
                <View style={styles.statDot} />
                <Text style={styles.statText}>{nowCount} Active</Text>
              </View>
            )}
            {upcomingCount > 0 && (
              <View style={[styles.statChip, styles.statChipBlue]}>
                <Text style={styles.statTextBlue}>{upcomingCount} Upcoming</Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      <FlatList
        data={assignments}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          assignments.length === 0 && { flex: 1 },
        ]}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>{"Today's Visits"}</Text>
        }
        ListEmptyComponent={loading ? null : <EmptyVisits />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void fetchAssignments(true); }}
            tintColor="#1a5fa8"
          />
        }
      />
    </View>
  );
}

function CardContent({
  item,
  status,
  hasGeolock,
}: {
  item: Assignment;
  status: 'upcoming' | 'now' | 'past';
  hasGeolock: boolean;
}) {
  return (
    <>
      <View style={styles.cardTop}>
        <View style={styles.clientInitialCircle}>
          <Text style={styles.clientInitial}>
            {item.clientName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardCenter}>
          <Text style={styles.clientName} numberOfLines={1}>{item.clientName}</Text>
          <Text style={styles.visitTime}>{formatTime(item.time)}</Text>
        </View>
        {item.visitState === 'in_progress' ? (
          <View style={styles.badgeInProgress}>
            <View style={styles.badgeDotGreen} />
            <Text style={styles.badgeInProgressText}>In progress</Text>
          </View>
        ) : item.visitState === 'completed' ? (
          <View style={styles.badgeCompleted}>
            <Text style={styles.badgeCompletedText}>Completed ✓</Text>
          </View>
        ) : status === 'now' ? (
          <View style={styles.badgeNow}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeNowText}>Now</Text>
          </View>
        ) : status === 'past' ? (
          <View style={styles.badgePast}>
            <Text style={styles.badgePastText}>Done</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardMeta}>
        {item.serviceCode ? (
          <View style={styles.serviceCodeBadge}>
            <Text style={styles.serviceCodeText}>{item.serviceCode}</Text>
          </View>
        ) : null}
        {hasGeolock ? (
          <View style={styles.geolockBadge}>
            <Text style={styles.geolockBadgeText}>📍 Geolock</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tapHint}>
        {item.visitState === 'in_progress'
          ? 'Tap to clock out →'
          : item.visitState === 'completed'
          ? 'Visit completed today'
          : 'Tap to clock in →'}
      </Text>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PRIMARY = '#1a5fa8';
const SESSION_GREEN = '#22c55e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff18',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    borderWidth: 1,
    borderColor: '#ffffff25',
  },
  sessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SESSION_GREEN },
  sessionPillText: {
    color: '#d4e8ff', fontSize: 10, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  logoutText: { color: '#90bde0', fontSize: 14, fontWeight: '600' },
  greeting: {
    fontSize: 26, fontWeight: '900', color: '#fff',
    textShadowColor: '#00000030', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  dateLabel: { fontSize: 13, color: '#90bde0', marginTop: 3, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ffffff18', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#ffffff20',
  },
  statChipBlue: { backgroundColor: '#ffffff10' },
  statDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fb923c' },
  statText: { color: '#fed7aa', fontSize: 11, fontWeight: '700' },
  statTextBlue: { color: '#bfdbfe', fontSize: 11, fontWeight: '700' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: '#7a98b4',
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginTop: 20, marginBottom: 12,
  },

  // Cards
  card: {
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#1a3a5c',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardStripe: { width: 5 },
  stripeUpcoming: { backgroundColor: PRIMARY },
  stripeNow: { backgroundColor: '#f97316' },
  stripePast: { backgroundColor: '#cbd5e1' },
  cardInner: { flex: 1, padding: 16, backgroundColor: '#fff' },
  cardInnerPast: { backgroundColor: '#fafafa' },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  clientInitialCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e8f0fa',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  clientInitial: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  cardCenter: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: '800', color: '#1a3a5c', marginBottom: 2 },
  visitTime: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  serviceCodeBadge: {
    backgroundColor: '#e8f0fa', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  serviceCodeText: {
    color: PRIMARY, fontSize: 10, fontWeight: '800',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  geolockBadge: {
    backgroundColor: '#fef3c7', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  geolockBadgeText: { color: '#92400e', fontSize: 10, fontWeight: '700' },
  tapHint: { fontSize: 11, color: '#b0c4d8', fontWeight: '500' },

  badgeNow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, gap: 5,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316' },
  badgeNowText: { color: '#ea580c', fontSize: 11, fontWeight: '800' },
  badgePast: {
    backgroundColor: '#f1f5f9', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgePastText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  badgeInProgress: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, gap: 5,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  badgeDotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  badgeInProgressText: { color: '#15803d', fontSize: 11, fontWeight: '800' },
  badgeCompleted: {
    backgroundColor: '#ecfdf5', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#a7f3d0',
  },
  badgeCompletedText: { color: '#047857', fontSize: 11, fontWeight: '700' },

  // Empty state
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#e8f0fa', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1a3a5c', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#7a98b4', textAlign: 'center', lineHeight: 21, paddingHorizontal: 32 },

  // Admin screen
  adminGradient: { flex: 1 },
  adminWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  adminIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#ffffff18', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: '#ffffff30',
  },
  adminEmoji: { fontSize: 44 },
  adminTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 12 },
  adminBody: { color: '#90bde0', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  adminUrlCard: {
    backgroundColor: '#ffffff18', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 16,
    alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#ffffff25',
  },
  adminUrlLabel: { color: '#90bde0', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  adminUrl: { color: '#fff', fontWeight: '900', fontSize: 18 },
  logoutCardBtn: {
    paddingHorizontal: 32, paddingVertical: 14,
    backgroundColor: '#ffffff15', borderRadius: 12,
    borderWidth: 1, borderColor: '#ffffff30',
  },
  logoutCardBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
