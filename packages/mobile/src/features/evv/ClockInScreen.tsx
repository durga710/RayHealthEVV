import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
}

function formatScheduledTime(iso: string | undefined): string {
  if (!iso) return 'Time not set';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'Time not set';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export default function ClockInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    assignmentId?: string;
    clientName?: string;
    scheduledTime?: string;
    serviceCode?: string;
  }>();
  const assignmentId = firstParam(params.assignmentId);
  const clientName = firstParam(params.clientName);
  const scheduledTime = firstParam(params.scheduledTime);
  const serviceCode = firstParam(params.serviceCode);

  const [isLoading, setIsLoading] = useState(false);
  const [visit, setVisit] = useState<{ id: string; clockInTime: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'ok' | 'denied'>('idle');

  useEffect(() => {
    if (!visit) { setElapsed(0); return; }
    const start = new Date(visit.clockInTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [visit]);

  const getLocation = async () => {
    setLocationStatus('checking');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationStatus('denied');
      return null;
    }
    setLocationStatus('ok');
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 0,
    };
  };

  const handleClockIn = async () => {
    if (!assignmentId) {
      Alert.alert('No visit selected', 'Go back and choose a scheduled visit.');
      return;
    }
    setIsLoading(true);
    const location = await getLocation();
    if (!location) {
      Alert.alert('Location required', 'Enable location access to record this EVV visit.');
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await apiClient.post('/api/evv/clock-in', {
        assignmentId,
        ...(serviceCode ? { serviceCode } : {}),
        location,
      });
      setVisit({ id: data.id, clockInTime: data.clockInTime ?? new Date().toISOString() });
    } catch {
      Alert.alert('Clock-in failed', 'Could not record your check-in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!visit) return;
    setIsLoading(true);
    const location = await getLocation();
    if (!location) {
      Alert.alert('Location required', 'Enable location access to record your clock-out.');
      setIsLoading(false);
      return;
    }
    try {
      await apiClient.post(`/api/evv/clock-out/${visit.id}`, { location });
      const totalElapsed = elapsed;
      setVisit(null);
      Alert.alert(
        'Visit complete',
        `Total visit time: ${formatElapsed(totalElapsed)}`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Clock-out failed', 'Could not record your check-out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isClockedIn = visit !== null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        {/* Visit info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>CLIENT</Text>
          <Text style={styles.clientName}>{clientName ?? '—'}</Text>
          {serviceCode ? (
            <View style={styles.serviceCodeBadge}>
              <Text style={styles.serviceCodeText}>{serviceCode}</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Scheduled</Text>
            <Text style={styles.infoVal}>{formatScheduledTime(scheduledTime)}</Text>
          </View>
          {assignmentId ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Visit ID</Text>
              <Text style={[styles.infoVal, styles.monoText]}>{assignmentId.slice(0, 8)}…</Text>
            </View>
          ) : null}
        </View>

        {/* Active visit timer */}
        {isClockedIn ? (
          <View style={styles.activeCard}>
            <View style={styles.activePulse} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeLabel}>Visit in progress</Text>
              <Text style={styles.elapsedTime}>{formatElapsed(elapsed)}</Text>
            </View>
          </View>
        ) : null}

        {/* Location indicator */}
        {locationStatus !== 'idle' ? (
          <View style={styles.locationRow}>
            <View
              style={[
                styles.locationDot,
                locationStatus === 'ok' && styles.locationDotOk,
                locationStatus === 'denied' && styles.locationDotErr,
              ]}
            />
            <Text style={styles.locationText}>
              {locationStatus === 'checking'
                ? 'Acquiring GPS…'
                : locationStatus === 'ok'
                ? 'Location confirmed'
                : 'Location access denied'}
            </Text>
          </View>
        ) : null}

        {/* Clock In / Out button */}
        {!isClockedIn ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.clockInBtn,
              (isLoading || !assignmentId) && styles.actionBtnDisabled,
              pressed && !isLoading && { opacity: 0.85 },
            ]}
            onPress={handleClockIn}
            disabled={isLoading || !assignmentId}
            accessibilityRole="button"
            accessibilityLabel="Clock in"
          >
            <Text style={styles.actionBtnIcon}>📍</Text>
            <Text style={styles.actionBtnText}>
              {isLoading ? 'Getting location…' : 'Clock In'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.clockOutBtn,
              isLoading && styles.actionBtnDisabled,
              pressed && !isLoading && { opacity: 0.85 },
            ]}
            onPress={handleClockOut}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Clock out"
          >
            <Text style={styles.actionBtnIcon}>✅</Text>
            <Text style={styles.actionBtnText}>
              {isLoading ? 'Getting location…' : 'Clock Out'}
            </Text>
          </Pressable>
        )}

        {!assignmentId ? (
          <Text style={styles.noAssignmentNote}>
            No visit selected. Go back and choose a visit from the dashboard.
          </Text>
        ) : null}

        <View style={styles.evvNote}>
          <Text style={styles.evvNoteText}>
            GPS coordinates are captured at clock-in and clock-out for EVV compliance and
            transmitted securely to your agency.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const PRIMARY = '#1a5fa8';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  scroll: { padding: 20, paddingBottom: 40 },

  backBtn: { marginBottom: 20 },
  backText: { color: PRIMARY, fontSize: 15, fontWeight: '600' },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ab0c8',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  clientName: { fontSize: 26, fontWeight: '800', color: '#1a3a5c', marginBottom: 10 },
  serviceCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f0fa',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  serviceCodeText: { color: PRIMARY, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: '#e8edf2', marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoKey: { color: '#6b8aa6', fontSize: 14 },
  infoVal: { color: '#1a3a5c', fontSize: 14, fontWeight: '600' },
  monoText: { fontVariant: ['tabular-nums'] },

  activeCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activePulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#16a34a' },
  activeLabel: { color: '#15803d', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  elapsedTime: {
    color: '#166534',
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  locationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' },
  locationDotOk: { backgroundColor: '#16a34a' },
  locationDotErr: { backgroundColor: '#ef4444' },
  locationText: { fontSize: 13, color: '#4a6480' },

  actionBtn: {
    borderRadius: 14,
    height: 64,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  clockInBtn: { backgroundColor: PRIMARY, shadowColor: PRIMARY },
  clockOutBtn: { backgroundColor: '#16a34a', shadowColor: '#16a34a' },
  actionBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  actionBtnIcon: { fontSize: 22 },
  actionBtnText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },

  noAssignmentNote: {
    color: '#9ab0c8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },

  evvNote: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#c9d8e8',
  },
  evvNoteText: { color: '#6b8aa6', fontSize: 12, lineHeight: 18 },
});
