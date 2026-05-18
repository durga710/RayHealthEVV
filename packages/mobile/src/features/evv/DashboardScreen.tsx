import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import { ensureNotificationPermission } from '../../lib/notification-permissions';
import { fireDevTestShiftAlert, scheduleShiftAlerts } from '../../lib/shift-alert-scheduler';

interface Assignment {
  id: string;
  clientName: string;
  time?: string; // ISO 8601 datetime when present; falsy when not yet scheduled.
  serviceCode?: string;
}

/**
 * Foreground vibration window: if the user is staring at the dashboard
 * when the 30-second mark is crossed, we fire a haptic warning so the
 * device buzzes even though a scheduled notification may suppress itself.
 * Range is 30s ±2s of slack to forgive interval drift.
 */
const FOREGROUND_FIRE_WINDOW_MS = 32_000;
const FOREGROUND_FIRE_MIN_MS = 28_000;
const FOREGROUND_TICK_MS = 5_000;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatRole(role: string | undefined): string {
  if (!role) return '';
  // 'caregiver' -> 'Caregiver', 'admin' -> 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function greetingFor(user: { role?: string; firstName?: string } | null): string {
  if (user?.firstName) return `Welcome back, ${user.firstName}.`;
  if (user?.role) return `Welcome back, ${formatRole(user.role)}.`;
  return 'Welcome back.';
}

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks `${assignmentId}-${dayKey}` entries we've already buzzed for in the
  // foreground today, so the interval doesn't spam haptics every tick.
  const firedForegroundRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const { data } = await apiClient.get('/api/assignments/caregiver');
        const list: Assignment[] = data || [];
        setAssignments(list);
        // Ask once, then schedule background notifications. Both no-op safely
        // if permission is denied — we never block the dashboard UI on this.
        const permStatus = await ensureNotificationPermission();
        if (permStatus === 'granted') {
          await scheduleShiftAlerts(list);
        }
      } catch (error) {
        // 401 is handled centrally by the api-client interceptor (clears state, shows toast).
        // For other errors, surface to the operator log without spamming console.error.
        if ((error as { response?: { status?: number } })?.response?.status !== 401) {
          console.log('Failed to fetch assignments', error);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchAssignments();
  }, []);

  // Foreground vibration tick. iOS scheduled notifications can be suppressed
  // when the app is foregrounded, so we mirror the 30-second alert in-app via
  // expo-haptics. Runs at FOREGROUND_TICK_MS cadence; fires once per shift
  // per day when the time-to-shift lands inside the 28-32s window.
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

  // DEV-only long-press on the SECURE SESSION pill to fire a test notification
  // ~5s in the future. Lets us validate permissions + channel + vibration on
  // device without waiting for a real shift. Hard-guarded so it cannot ship.
  const handleSessionPillLongPress = () => {
    if (!__DEV__) return;
    void fireDevTestShiftAlert();
  };

  const renderItem = ({ item }: { item: Assignment }) => (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => router.push({
        pathname: '/clockin',
        params: {
          assignmentId: item.id,
          clientName: item.clientName,
          scheduledTime: item.time ?? '',
          serviceCode: item.serviceCode ?? ''
        }
      })}
    >
      <Text style={styles.itemText}>{item.clientName}</Text>
      <Text>{item.time || 'Time not specified'}</Text>
      {item.serviceCode ? <Text style={styles.serviceCode}>{item.serviceCode}</Text> : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBlock}>
        {/* SECURE SESSION pill — mirrors the web client's COOKIE SESSION ACTIVE indicator.
            Long-press is a DEV-only gesture to fire a test shift alert; it is a no-op
            outside __DEV__ so prod users see only the static indicator. */}
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

        <View style={styles.headerRow}>
          <Text style={styles.greeting}>{greetingFor(user)}</Text>
          <Pressable
            onPress={() => { void logout().finally(() => router.replace('/login')); }}
            hitSlop={12}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{"Today's Visits"}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a5fa8" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={assignments}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No visits scheduled for today.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const SESSION_GREEN = '#16a34a';
// 12% tint of #16a34a — using hex alpha (1F ~= 12%).
const SESSION_GREEN_TINT = '#16a34a1F';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  headerBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  sessionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SESSION_GREEN_TINT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SESSION_GREEN,
    marginRight: 6
  },
  sessionPillText: {
    color: SESSION_GREEN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  greeting: { fontSize: 20, fontWeight: '600', color: '#1a3a5c', flexShrink: 1, paddingRight: 12 },
  logoutButton: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'flex-end' },
  logoutButtonPressed: { opacity: 0.6 },
  logoutText: { color: '#1a5fa8', fontWeight: '600' },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a3a5c', marginTop: 16 },
  item: { backgroundColor: 'white', padding: 20, marginVertical: 8, marginHorizontal: 16, borderRadius: 8, elevation: 1 },
  itemPressed: { opacity: 0.75 },
  itemText: { fontSize: 18, fontWeight: '500' },
  serviceCode: { marginTop: 8, color: '#1a5fa8', fontWeight: '600' }
});
