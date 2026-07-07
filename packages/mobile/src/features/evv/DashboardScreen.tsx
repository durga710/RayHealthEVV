import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../lib/AuthContext';
import { useFocusEffect, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import ErrorRetry from '../common/ErrorRetry';
import EmptyState from '../common/EmptyState';
import { SkeletonList } from '../common/Skeleton';
import { colors, typography, radii, shadow, gradients } from '../common/tokens';
import { ensureNotificationPermission } from '../../lib/notification-permissions';
import { fireDevTestShiftAlert, scheduleShiftAlerts } from '../../lib/shift-alert-scheduler';
import { deriveVisitState, resumableVisit, type VisitState } from '../../lib/visit-state';

interface Assignment {
  id: string;
  clientName: string;
  clientAddress?: string;
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
  clientAddressLine1?: string | null;
  clientCity?: string | null;
  clientState?: string | null;
  clientLatitude: number | null;
  clientLongitude: number | null;
  geofenceRadiusM: number;
  currentVisitId: string | null;
  currentVisitStatus: string | null;
  currentClockInTime: string | null;
  currentClockOutTime: string | null;
}

// The fire window (8s) is wider than the tick (5s) so a tick always lands
// inside it once as the countdown passes through, the previous 4s window could
// be straddled and skipped. firedForegroundRef keeps it to a single haptic.
const FOREGROUND_FIRE_WINDOW_MS = 33_000;
const FOREGROUND_FIRE_MIN_MS = 25_000;
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

/** Compact "time until" / "time since" label for the next-visit countdown. */
function formatCountdown(ms: number): string {
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (totalMin > 0) return `${totalMin} min`;
  return `${Math.max(0, Math.floor(abs / 1000))}s`;
}

/** Running clock since clock-in, for the in-progress hero. */
function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

/**
 * Choose the single visit the hero card should surface: an in-progress visit
 * first (the caregiver is mid-shift), otherwise the soonest visit that is not
 * yet completed. Returns null when nothing is actionable today.
 */
function pickHeroVisit(assignments: Assignment[]): Assignment | null {
  const inProgress = assignments.find((a) => a.visitState === 'in_progress');
  if (inProgress) return inProgress;
  const actionable = assignments
    .filter((a) => a.visitState !== 'completed')
    .filter((a) => getVisitStatus(a.time) !== 'past')
    .sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.time ? new Date(b.time).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  return actionable[0] ?? null;
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
      <LinearGradient colors={gradients.header} style={styles.adminGradient}>
        <View style={[styles.adminWrap, { paddingTop: insets.top + 16 }]}>
          <View style={styles.adminIconCircle}>
            <Ionicons name="desktop-outline" size={40} color={colors.onGradient} />
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

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Drives the live next-visit countdown / in-progress elapsed clock on the
  // hero card. Ticks once a second only while there are visits to count toward.
  const [nowTs, setNowTs] = useState(() => Date.now());
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
        clientAddress:
          [r.clientAddressLine1, r.clientCity, r.clientState].filter(Boolean).join(', ') || undefined,
        time: r.scheduledStartTime ?? undefined,
        // serviceCode is re-derived server-side at clock-in; not needed here.
        serviceCode: undefined,
        clientLat: r.clientLatitude ?? null,
        clientLng: r.clientLongitude ?? null,
        clientGeofenceM: r.geofenceRadiusM ?? 150,
        visitState: deriveVisitState(r),
        // Gated on resumableVisit() (not a raw copy of currentVisitId) so a
        // completed visit, which still carries the day's currentVisitId , 
        // doesn't get treated as reopenable when the card is tapped again.
        openVisitId: resumableVisit(r)?.id ?? null,
        clockInTime: resumableVisit(r)?.clockInTime ?? null,
      }));
      setAssignments(list);
      setError(null);
      const permStatus = await ensureNotificationPermission();
      if (permStatus === 'granted') {
        await scheduleShiftAlerts(list);
      }
    } catch {
      // 401 redirects to login via the central handler; surface other failures
      // so a dropped connection isn't shown as "no visits today".
      setError('Could not load your visits.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refetch on focus so visits/schedule changes made in the web app appear
  // when the caregiver opens or returns to the dashboard, not only on a
  // manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      // Admins/coordinators see the "use the web portal" screen, not the
      // caregiver schedule, don't fire the caregiver-only /today request.
      if (user?.role === 'admin' || user?.role === 'coordinator') return;
      void fetchAssignments();
    }, [user?.role]),
  );

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

  // Second-resolution clock for the hero countdown/elapsed readout. Gated on
  // having at least one visit so an empty day doesn't re-render every second.
  useEffect(() => {
    if (assignments.length === 0) return;
    const handle = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [assignments.length]);

  const handleLogout = () => {
    void logout().finally(() => router.replace('/login'));
  };

  // Single source of truth for opening a visit's clock screen, used by both
  // the hero primary action and each timeline card so their params never drift.
  const openVisit = useCallback(
    (item: Assignment) => {
      router.push({
        pathname: '/clockin',
        params: {
          assignmentId: item.id,
          clientName: item.clientName,
          clientAddress: item.clientAddress ?? '',
          scheduledTime: item.time ?? '',
          serviceCode: item.serviceCode ?? '',
          clientLat: item.clientLat != null ? String(item.clientLat) : '',
          clientLng: item.clientLng != null ? String(item.clientLng) : '',
          clientGeofenceM: item.clientGeofenceM != null ? String(item.clientGeofenceM) : '150',
          openVisitId: item.openVisitId ?? '',
          clockInTime: item.clockInTime ?? '',
        },
      });
    },
    [router],
  );

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
  const doneCount = assignments.filter(a => a.visitState === 'completed').length;
  const heroVisit = pickHeroVisit(assignments);

  const renderItem = ({ item, index }: { item: Assignment; index: number }) => {
    const status = getVisitStatus(item.time);
    const hasGeolock = item.clientLat != null && item.clientLng != null;
    const isNow = status === 'now';
    const isPast = status === 'past';

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(300)}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
        onPress={() => openVisit(item)}
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
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* Header */}
      <LinearGradient colors={gradients.header} style={[styles.header, { paddingTop: insets.top + 12 }]}>
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
            onPress={() => router.push('/help')}
            hitSlop={10}
            style={({ pressed }) => [styles.helpBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Get help"
          >
            <Ionicons name="help-circle-outline" size={18} color="#d4e8ff" />
            <Text style={styles.helpBtnText}>Help</Text>
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
          assignments.length > 0 ? (
            <View>
              {heroVisit ? (
                <NextVisitHero visit={heroVisit} nowTs={nowTs} onPress={() => openVisit(heroVisit)} />
              ) : (
                <AllDoneHero doneCount={doneCount} />
              )}
              <Text style={styles.sectionTitle}>{"Today's Visits"}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={4} />
          ) : error ? (
            <ErrorRetry message={error} onRetry={fetchAssignments} />
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="calendar-clear-outline"
                title="No visits today"
                message="You're all clear. Assigned visits appear here as soon as your coordinator schedules them, pull down to refresh."
              />
              <Pressable
                onPress={() => router.push('/help')}
                style={({ pressed }) => [styles.emptyHelpBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="Open help"
              >
                <Ionicons name="help-buoy-outline" size={16} color={colors.brandBlue} />
                <Text style={styles.emptyHelpText}>Something look wrong? Get help</Text>
              </Pressable>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void fetchAssignments(true); }}
            tintColor={colors.brandBlue}
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
          {item.clientAddress ? (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.clientAddress} numberOfLines={1}>{item.clientAddress}</Text>
            </View>
          ) : null}
          <Text style={styles.visitTime}>{formatTime(item.time)}</Text>
        </View>
        {item.visitState === 'in_progress' ? (
          <View style={styles.badgeInProgress}>
            <View style={styles.badgeDotGreen} />
            <Text style={styles.badgeInProgressText}>In progress</Text>
          </View>
        ) : item.visitState === 'completed' ? (
          <View style={styles.badgeCompleted}>
            <Text style={styles.badgeCompletedText}>Completed</Text>
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
            <Text style={styles.geolockBadgeText}>GPS {item.clientGeofenceM ?? 150}m</Text>
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

// ─── Next-visit hero ────────────────────────────────────────────────────────
// The single most important thing on the screen: what to do next, when, and one
// clear tap to act. Shows a live countdown before the shift, a running elapsed
// clock while in progress, a structured route-preview slot (placeholder for a
// future map, deliberately not a faked live route), and an unmistakable
// clock-in / clock-out affordance.
function NextVisitHero({
  visit,
  nowTs,
  onPress,
}: {
  visit: Assignment;
  nowTs: number;
  onPress: () => void;
}) {
  const inProgress = visit.visitState === 'in_progress';
  const startMs = visit.time ? new Date(visit.time).getTime() : NaN;
  const hasTime = Number.isFinite(startMs);
  const status = getVisitStatus(visit.time);
  const startsSoon = hasTime && startMs - nowTs <= 1_800_000 && startMs - nowTs > 0;

  // Countdown / elapsed line.
  let timingLabel: string;
  let timingValue: string;
  if (inProgress && visit.clockInTime) {
    const inMs = new Date(visit.clockInTime).getTime();
    timingLabel = 'Elapsed';
    timingValue = Number.isFinite(inMs) ? formatElapsed(nowTs - inMs) : ', ';
  } else if (!hasTime) {
    timingLabel = 'Scheduled';
    timingValue = 'Time TBD';
  } else if (startMs <= nowTs) {
    timingLabel = 'Starts';
    timingValue = 'Now';
  } else {
    timingLabel = 'Starts in';
    timingValue = formatCountdown(startMs - nowTs);
  }

  const eyebrow = inProgress
    ? 'Visit in progress'
    : status === 'now' || startsSoon
    ? 'Up next · starting soon'
    : 'Up next';

  const actionLabel = inProgress ? 'Tap to clock out' : 'Tap to clock in';
  const actionIcon = inProgress ? 'stop-circle' : 'location';

  return (
    <Animated.View entering={FadeInDown.duration(320)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { transform: [{ scale: 0.995 }], opacity: 0.97 }]}
        accessibilityRole="button"
        accessibilityLabel={`${eyebrow}. ${visit.clientName}. ${timingLabel} ${timingValue}. ${actionLabel}.`}
      >
        <LinearGradient
          colors={inProgress ? gradients.ctaSuccess : gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroInner}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroEyebrowWrap}>
              {inProgress ? <View style={styles.heroLiveDot} /> : null}
              <Text style={styles.heroEyebrow}>{eyebrow.toUpperCase()}</Text>
            </View>
            <View style={styles.heroTiming}>
              <Text style={styles.heroTimingLabel}>{timingLabel.toUpperCase()}</Text>
              <Text style={styles.heroTimingValue}>{timingValue}</Text>
            </View>
          </View>

          <Text style={styles.heroClient} numberOfLines={1}>{visit.clientName}</Text>
          <View style={styles.heroMetaRow}>
            <Ionicons name="time-outline" size={13} color={colors.onGradientSoft} />
            <Text style={styles.heroMeta}>{formatTime(visit.time)}</Text>
            {visit.clientAddress ? (
              <>
                <Text style={styles.heroMetaDivider}>·</Text>
                <Ionicons name="location-outline" size={13} color={colors.onGradientSoft} />
                <Text style={styles.heroMeta} numberOfLines={1}>{visit.clientAddress}</Text>
              </>
            ) : null}
          </View>

          {/* Route preview, structured slot for a future map. Intentionally a
              labelled placeholder, never a fabricated live route. */}
          <View style={styles.routePreview}>
            <View style={styles.routePreviewIcon}>
              <Ionicons name="map-outline" size={18} color={colors.onGradientSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routePreviewTitle}>Route preview</Text>
              <Text style={styles.routePreviewSub}>
                {visit.clientLat != null && visit.clientLng != null
                  ? 'Live map opens on the clock-in screen'
                  : 'No location on file for this client yet'}
              </Text>
            </View>
          </View>

          <View style={styles.heroCta}>
            <Ionicons name={actionIcon} size={18} color={colors.onGradient} />
            <Text style={styles.heroCtaText}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.onGradient} />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// Shown in the hero slot when every scheduled visit today is already done, the
// caregiver's "you're covered" moment, not a blank space.
function AllDoneHero({ doneCount }: { doneCount: number }) {
  return (
    <Animated.View entering={FadeInDown.duration(320)}>
      <LinearGradient colors={gradients.ctaSuccess} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroInner}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroEyebrowWrap}>
            <Ionicons name="checkmark-circle" size={16} color={colors.onGradient} />
            <Text style={styles.heroEyebrow}>ALL VISITS DONE</Text>
          </View>
        </View>
        <Text style={styles.heroClient}>You&apos;re all caught up</Text>
        <Text style={styles.heroMeta}>
          {doneCount > 0
            ? `${doneCount} ${doneCount === 1 ? 'visit' : 'visits'} completed and recorded today.`
            : 'Nothing left to clock in for right now.'}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SESSION_GREEN = '#22c55e';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },

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
  helpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ffffff18', borderRadius: radii.pill,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#ffffff25',
  },
  helpBtnText: { ...typography.caption, fontWeight: '800', color: '#d4e8ff' },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff18',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    borderWidth: 1,
    borderColor: '#ffffff25',
  },
  sessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SESSION_GREEN },
  sessionPillText: {
    ...typography.label,
    fontSize: 10,
    fontWeight: '700',
    color: '#d4e8ff',
  },
  greeting: {
    ...typography.hero,
    color: colors.onGradient,
    textShadowColor: '#00000030', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  dateLabel: { ...typography.sub, color: colors.onGradientSoft, marginTop: 3, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#ffffff18', borderRadius: radii.pill,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#ffffff20',
  },
  statChipBlue: { backgroundColor: '#ffffff10' },
  statDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fb923c' },
  statText: { ...typography.caption, fontWeight: '700', color: '#fed7aa' },
  statTextBlue: { ...typography.caption, fontWeight: '700', color: '#bfdbfe' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },
  sectionTitle: {
    ...typography.label,
    letterSpacing: 1.2,
    color: colors.textMuted,
    marginTop: 20, marginBottom: 12,
  },

  // Next-visit hero
  heroInner: {
    borderRadius: radii.hero,
    padding: 18,
    marginTop: 16,
    ...shadow.raised,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  heroEyebrowWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#bbf7d0' },
  heroEyebrow: { ...typography.label, fontSize: 11, letterSpacing: 1, color: colors.onGradientSoft },
  heroTiming: { alignItems: 'flex-end' },
  heroTimingLabel: { ...typography.caption, fontSize: 9, letterSpacing: 0.8, color: colors.onGradientSoft },
  heroTimingValue: { color: colors.onGradient, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 1 },
  heroClient: { ...typography.hero, fontSize: 24, color: colors.onGradient, letterSpacing: -0.4 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  heroMeta: { ...typography.sub, color: colors.onGradientSoft, flexShrink: 1 },
  heroMetaDivider: { color: colors.onGradientSoft, marginHorizontal: 2 },
  routePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff14', borderRadius: radii.md,
    padding: 12, marginTop: 14,
    borderWidth: 1, borderColor: '#ffffff20',
  },
  routePreviewIcon: {
    width: 38, height: 38, borderRadius: radii.sm,
    backgroundColor: '#ffffff1a', justifyContent: 'center', alignItems: 'center',
  },
  routePreviewTitle: { ...typography.caption, fontWeight: '800', color: colors.onGradient },
  routePreviewSub: { ...typography.caption, color: colors.onGradientSoft, marginTop: 2 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ffffff26', borderRadius: radii.md,
    height: 50, marginTop: 14,
    borderWidth: 1, borderColor: '#ffffff33',
  },
  heroCtaText: { color: colors.onGradient, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  // Empty state
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyHelpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.cardBg, borderRadius: radii.pill,
    paddingHorizontal: 18, paddingVertical: 11,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.subtle,
  },
  emptyHelpText: { ...typography.sub, fontWeight: '800', color: colors.brandBlue },

  // Cards
  card: {
    borderRadius: radii.lg,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow.card,
  },
  cardStripe: { width: 5 },
  stripeUpcoming: { backgroundColor: colors.brandBlue },
  stripeNow: { backgroundColor: '#f97316' },
  stripePast: { backgroundColor: '#cbd5e1' },
  cardInner: { flex: 1, padding: 16, backgroundColor: colors.cardBg },
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
  clientInitial: { fontSize: 20, fontWeight: '800', color: colors.brandBlue },
  cardCenter: { flex: 1 },
  clientName: { ...typography.heading, color: colors.textPrimary, marginBottom: 2 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 },
  clientAddress: { flex: 1, fontSize: 12, color: colors.textSecondary },
  visitTime: { ...typography.sub, fontWeight: '600', color: colors.brandBlue },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  serviceCodeBadge: {
    backgroundColor: '#e8f0fa', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  serviceCodeText: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.brandBlue,
  },
  geolockBadge: {
    backgroundColor: colors.amberBg, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  geolockBadgeText: { ...typography.caption, fontWeight: '800', color: colors.amberDark },
  tapHint: { ...typography.caption, fontWeight: '500', color: colors.placeholder },

  badgeNow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: radii.pill,
    paddingHorizontal: 10, paddingVertical: 4, gap: 5,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316' },
  badgeNowText: { ...typography.caption, fontWeight: '800', color: '#ea580c' },
  badgePast: {
    backgroundColor: '#f1f5f9', borderRadius: radii.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgePastText: { ...typography.caption, fontWeight: '700', color: colors.textMuted },
  badgeInProgress: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.successBg,
    borderRadius: radii.pill,
    paddingHorizontal: 10, paddingVertical: 4, gap: 5,
    borderWidth: 1, borderColor: colors.successBorder,
  },
  badgeDotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  badgeInProgressText: { ...typography.caption, fontWeight: '800', color: colors.successDark },
  badgeCompleted: {
    backgroundColor: colors.successBg, borderRadius: radii.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.successBorder,
  },
  badgeCompletedText: { ...typography.caption, fontWeight: '700', color: colors.successDark },

  // Admin screen
  adminGradient: { flex: 1 },
  adminWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  adminIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#ffffff18', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: '#ffffff30',
  },
  adminTitle: { ...typography.title, color: colors.onGradient, textAlign: 'center', marginBottom: 12 },
  adminBody: { color: colors.onGradientSoft, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  adminUrlCard: {
    backgroundColor: '#ffffff18', borderRadius: radii.md, paddingHorizontal: 28, paddingVertical: 16,
    alignItems: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#ffffff25',
  },
  adminUrlLabel: {
    ...typography.label,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.onGradientSoft,
    marginBottom: 4,
  },
  adminUrl: { color: colors.onGradient, fontWeight: '900', fontSize: 18 },
  logoutCardBtn: {
    paddingHorizontal: 32, paddingVertical: 14,
    backgroundColor: '#ffffff15', borderRadius: 12,
    borderWidth: 1, borderColor: '#ffffff30',
  },
  logoutCardBtnText: { ...typography.body, fontWeight: '700', color: colors.onGradient },
});
