import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import { ensureNotificationPermission } from '../../lib/notification-permissions';
import { fireDevTestShiftAlert, scheduleShiftAlerts } from '../../lib/shift-alert-scheduler';

interface Assignment {
  id: string;
  clientName: string;
  time?: string;
  serviceCode?: string;
  clientLat?: number | null;
  clientLng?: number | null;
  clientGeofenceM?: number;
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
  return user?.firstName ? `${timeGreet}, ${user.firstName}` : timeGreet;
}

function AdminScreen({ role, onLogout }: { role: string; onLogout: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.adminWrap}>
        <Text style={styles.adminEmoji}>🖥️</Text>
        <Text style={styles.adminTitle}>
          {role === 'admin' ? 'Admin Portal' : 'Coordinator Portal'}
        </Text>
        <Text style={styles.adminBody}>
          The mobile app is for caregivers. Use the web portal to manage schedules, review visits,
          and configure your agency.
        </Text>
        <Text style={styles.adminUrl}>rayhealthevv.com</Text>
        <Pressable
          onPress={onLogout}
          style={({ pressed }) => [styles.logoutCardBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={styles.logoutCardBtnText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function EmptyVisits() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>📋</Text>
      <Text style={styles.emptyTitle}>No visits scheduled</Text>
      <Text style={styles.emptyBody}>Your assigned visits will appear here.</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firedForegroundRef = useRef<Set<string>>(new Set());

  const fetchAssignments = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { data } = await apiClient.get('/api/assignments/caregiver');
      const list: Assignment[] = data || [];
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

  const renderItem = ({ item }: { item: Assignment }) => {
    const status = getVisitStatus(item.time);
    const hasGeolock = item.clientLat != null && item.clientLng != null;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
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
            },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Visit with ${item.clientName}, tap to open`}
      >
        <View
          style={[
            styles.cardAccent,
            status === 'now' && styles.accentNow,
            status === 'past' && styles.accentPast,
          ]}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.clientName}>{item.clientName}</Text>
            {status === 'now' ? (
              <View style={styles.badgeNow}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeNowText}>Now</Text>
              </View>
            ) : status === 'past' ? (
              <View style={styles.badgePast}>
                <Text style={styles.badgePastText}>Past</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.visitTime}>{formatTime(item.time)}</Text>
          <View style={styles.cardMeta}>
            {item.serviceCode ? (
              <Text style={styles.serviceCode}>{item.serviceCode}</Text>
            ) : null}
            {hasGeolock ? (
              <View style={styles.geolockBadge}>
                <Text style={styles.geolockBadgeText}>📍 Geolock</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tapHint}>Tap to clock in →</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable
            onLongPress={handleSessionPillLongPress}
            delayLongPress={600}
            style={styles.sessionPill}
            accessibilityRole="text"
            accessibilityLabel="Secure session active"
          >
            <View style={styles.sessionDot} />
            <Text style={styles.sessionPillText}>Secure Session</Text>
          </Pressable>
          <Pressable
            onPress={handleLogout}
            hitSlop={12}
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
        <Text style={styles.greeting}>{greetingFor(user)}</Text>
        <Text style={styles.dateLabel}>{todayStr}</Text>
      </View>

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
    </SafeAreaView>
  );
}

const PRIMARY = '#1a5fa8';
const SESSION_GREEN = '#16a34a';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf2',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  sessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SESSION_GREEN },
  sessionPillText: {
    color: SESSION_GREEN, fontSize: 10, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  logoutText: { color: '#5b8fc9', fontSize: 14, fontWeight: '600' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1a3a5c' },
  dateLabel: { fontSize: 13, color: '#6b8aa6', marginTop: 2 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#4a6480',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 20, marginBottom: 10,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  cardAccent: { width: 4, backgroundColor: PRIMARY },
  accentNow: { backgroundColor: '#f97316' },
  accentPast: { backgroundColor: '#d1d5db' },
  cardBody: { flex: 1, padding: 16 },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  clientName: { fontSize: 17, fontWeight: '700', color: '#1a3a5c', flex: 1, paddingRight: 8 },
  visitTime: { fontSize: 15, color: PRIMARY, fontWeight: '600', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  serviceCode: {
    backgroundColor: '#e8f0fa', color: PRIMARY,
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    textTransform: 'uppercase',
  },
  geolockBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  geolockBadgeText: { color: '#92400e', fontSize: 11, fontWeight: '600' },
  tapHint: { fontSize: 12, color: '#9ab0c8' },

  badgeNow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff7ed', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3, gap: 4,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316' },
  badgeNowText: { color: '#ea580c', fontSize: 11, fontWeight: '700' },
  badgePast: {
    backgroundColor: '#f3f4f6', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgePastText: { color: '#9ca3af', fontSize: 11, fontWeight: '600' },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a3a5c', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#6b8aa6', textAlign: 'center' },

  adminWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  adminEmoji: { fontSize: 52, marginBottom: 16 },
  adminTitle: { fontSize: 22, fontWeight: '700', color: '#1a3a5c', textAlign: 'center', marginBottom: 12 },
  adminBody: { color: '#4a6480', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  adminUrl: { color: PRIMARY, fontWeight: '700', fontSize: 16, marginBottom: 32 },
  logoutCardBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: '#f0f4f8', borderRadius: 10,
    borderWidth: 1, borderColor: '#c9d8e8',
  },
  logoutCardBtnText: { color: PRIMARY, fontWeight: '600', fontSize: 15 },
});
