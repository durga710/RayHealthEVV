import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

function formatScheduledTime(iso: string | undefined): string {
  if (!iso) return 'Time not set';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : 'Time not set';
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

// ─── Geo-ring ─────────────────────────────────────────────────────────────────

type GeoStatus = 'idle' | 'requesting' | 'denied' | 'inside' | 'outside';

interface GeoRingProps {
  status: GeoStatus;
  distanceM: number | null;
  allowedM: number;
  accuracy: number | null;
}

function GeoRing({ status, distanceM, allowedM, accuracy }: GeoRingProps) {
  const isInside = status === 'inside';
  const isOutside = status === 'outside';
  const isWaiting = status === 'idle' || status === 'requesting';

  const ringGradient: [string, string] = isInside
    ? ['#16a34a', '#4ade80']
    : isOutside
    ? ['#ef4444', '#f87171']
    : ['#94a3b8', '#cbd5e1'];

  const bgGradient: [string, string] = isInside
    ? ['#f0fdf4', '#dcfce7']
    : isOutside
    ? ['#fef2f2', '#fee2e2']
    : ['#f8fafc', '#f1f5f9'];

  const textColor = isInside ? '#15803d' : isOutside ? '#dc2626' : '#94a3b8';

  const pct = distanceM != null && allowedM > 0
    ? Math.min(distanceM / allowedM, 2.5)
    : null;

  return (
    <LinearGradient colors={bgGradient} style={styles.geoRingOuter}>
      {/* Concentric decorative rings */}
      <View style={[styles.concRing, styles.concRing3, { borderColor: ringGradient[0] + '18' }]} />
      <View style={[styles.concRing, styles.concRing2, { borderColor: ringGradient[0] + '30' }]} />
      <View style={[styles.concRing, styles.concRing1, { borderColor: ringGradient[0] + '55' }]} />

      {/* Inner circle */}
      <View style={[styles.geoRingCircle, { borderColor: ringGradient[0] }]}>
        <LinearGradient colors={ringGradient} style={styles.geoRingCircleDot} />

        {isWaiting ? (
          <Text style={[styles.geoRingIdleText, { color: textColor }]}>
            {status === 'requesting' ? 'Locating…' : 'GPS'}
          </Text>
        ) : status === 'denied' ? (
          <Text style={[styles.geoRingIdleText, { color: textColor }]}>Denied</Text>
        ) : (
          <Text style={[styles.geoRingDistanceText, { color: textColor }]}>
            {distanceM != null ? formatDistance(distanceM) : '—'}
          </Text>
        )}

        {pct != null && (
          <Text style={[styles.geoRingPctText, { color: textColor + 'cc' }]}>
            {Math.round(pct * 100)}% of zone
          </Text>
        )}
      </View>

      {/* Status label below the ring */}
      <View style={styles.geoRingLabelRow}>
        <View style={[styles.geoRingStatusDot, { backgroundColor: ringGradient[0] }]} />
        <Text style={[styles.geoRingStatusText, { color: textColor }]}>
          {isInside
            ? 'Within allowed zone'
            : isOutside
            ? 'Outside allowed zone'
            : status === 'denied'
            ? 'Location access denied'
            : 'Acquiring GPS signal…'}
        </Text>
      </View>

      <Text style={styles.geoRingAllowed}>
        Allowed radius: {formatDistance(allowedM)}
        {accuracy != null ? `  ·  GPS ±${Math.round(accuracy)} m` : ''}
      </Text>
    </LinearGradient>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ClockInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    assignmentId?: string;
    clientName?: string;
    scheduledTime?: string;
    serviceCode?: string;
    clientLat?: string;
    clientLng?: string;
    clientGeofenceM?: string;
  }>();

  const assignmentId = firstParam(params.assignmentId);
  const clientName = firstParam(params.clientName);
  const scheduledTime = firstParam(params.scheduledTime);
  const serviceCode = firstParam(params.serviceCode);
  const clientLat = params.clientLat ? parseFloat(firstParam(params.clientLat) ?? '') : null;
  const clientLng = params.clientLng ? parseFloat(firstParam(params.clientLng) ?? '') : null;
  const clientGeofenceM = params.clientGeofenceM
    ? parseInt(firstParam(params.clientGeofenceM) ?? '150', 10)
    : 150;
  const hasGeolock =
    Number.isFinite(clientLat) && Number.isFinite(clientLng) &&
    clientLat !== null && clientLng !== null;

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [visit, setVisit] = useState<{ id: string; clockInTime: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [geofenceError, setGeofenceError] = useState<{
    message: string; distanceM: number; allowedM: number;
  } | null>(null);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  const startWatching = useCallback(async () => {
    setGeoStatus('requesting');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGeoStatus('denied');
      return;
    }
    locationSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 4000 },
      (loc) => {
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCurrentCoords(coords);
        setAccuracy(loc.coords.accuracy ?? null);
        if (hasGeolock && clientLat != null && clientLng != null) {
          const d = haversineM(coords, { lat: clientLat, lng: clientLng });
          setDistanceM(d);
          setGeoStatus(d <= clientGeofenceM ? 'inside' : 'outside');
        } else {
          setGeoStatus('inside');
        }
      }
    );
  }, [hasGeolock, clientLat, clientLng, clientGeofenceM]);

  useEffect(() => {
    void startWatching();
    return () => { locationSubRef.current?.remove(); };
  }, [startWatching]);

  useEffect(() => {
    if (!visit) { setElapsed(0); return; }
    const start = new Date(visit.clockInTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [visit]);

  const handleClockIn = async () => {
    if (!assignmentId) {
      Alert.alert('No visit selected', 'Go back and choose a scheduled visit.');
      return;
    }
    if (!currentCoords) {
      Alert.alert('No GPS signal', 'Wait for your location before clocking in.');
      return;
    }
    setGeofenceError(null);
    setIsLoading(true);
    try {
      const { data } = await apiClient.post('/api/evv/clock-in', {
        assignmentId,
        ...(serviceCode ? { serviceCode } : {}),
        location: { lat: currentCoords.lat, lng: currentCoords.lng, accuracy: accuracy ?? 0 },
      });
      setVisit({ id: data.id, clockInTime: data.clockInTime ?? new Date().toISOString() });
    } catch (err: unknown) {
      const resp = (err as {
        response?: { status?: number; data?: { code?: string; message?: string; distanceM?: number; allowedM?: number } }
      })?.response;
      if (resp?.status === 422 && resp.data?.code === 'GEOFENCE_OUT_OF_BOUNDS') {
        setGeofenceError({
          message: resp.data.message ?? 'You are outside the allowed zone.',
          distanceM: resp.data.distanceM ?? 0,
          allowedM: resp.data.allowedM ?? clientGeofenceM,
        });
      } else {
        Alert.alert('Clock-in failed', 'Could not record your check-in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!visit || !currentCoords) return;
    setGeofenceError(null);
    setIsLoading(true);
    try {
      await apiClient.post(`/api/evv/clock-out/${visit.id}`, {
        location: { lat: currentCoords.lat, lng: currentCoords.lng, accuracy: accuracy ?? 0 },
      });
      const totalElapsed = elapsed;
      setVisit(null);
      Alert.alert(
        'Visit complete ✓',
        `Total visit time: ${formatElapsed(totalElapsed)}`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const resp = (err as {
        response?: { status?: number; data?: { code?: string; message?: string; distanceM?: number; allowedM?: number } }
      })?.response;
      if (resp?.status === 422 && resp.data?.code === 'GEOFENCE_OUT_OF_BOUNDS') {
        setGeofenceError({
          message: resp.data.message ?? 'You are outside the allowed zone.',
          distanceM: resp.data.distanceM ?? 0,
          allowedM: resp.data.allowedM ?? clientGeofenceM,
        });
      } else {
        Alert.alert('Clock-out failed', 'Could not record your check-out. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isClockedIn = visit !== null;
  const canClockIn = currentCoords != null && geoStatus === 'inside' && !isLoading;
  const canClockOut = isClockedIn && currentCoords != null && !isLoading;

  const initials = (clientName ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      {/* Gradient header */}
      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={styles.heroHeader}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.heroContent}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroClientName}>{clientName ?? '—'}</Text>
          <View style={styles.heroBadgeRow}>
            {serviceCode ? (
              <View style={styles.heroServiceBadge}>
                <Text style={styles.heroServiceText}>{serviceCode}</Text>
              </View>
            ) : null}
            {hasGeolock ? (
              <View style={styles.heroGeolockBadge}>
                <Text style={styles.heroGeolockText}>📍 Geolock</Text>
              </View>
            ) : (
              <View style={styles.heroNoGeolockBadge}>
                <Text style={styles.heroNoGeolockText}>No geolock</Text>
              </View>
            )}
          </View>
          <View style={styles.heroScheduleRow}>
            <Text style={styles.heroScheduleLabel}>Scheduled</Text>
            <Text style={styles.heroScheduleVal}>{formatScheduledTime(scheduledTime)}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Geo-ring */}
        {hasGeolock && (
          <GeoRing
            status={geoStatus}
            distanceM={distanceM}
            allowedM={clientGeofenceM}
            accuracy={accuracy}
          />
        )}

        {/* Geofence violation banner */}
        {geofenceError ? (
          <View style={styles.geofenceBanner}>
            <Text style={styles.geofenceBannerTitle}>⛔ Outside allowed zone</Text>
            <Text style={styles.geofenceBannerMsg}>{geofenceError.message}</Text>
            <View style={styles.geofenceBannerStats}>
              <View style={styles.geofenceStat}>
                <Text style={styles.geofenceStatLabel}>Your distance</Text>
                <Text style={styles.geofenceStatVal}>{formatDistance(geofenceError.distanceM)}</Text>
              </View>
              <View style={styles.geofenceStatDivider} />
              <View style={styles.geofenceStat}>
                <Text style={styles.geofenceStatLabel}>Allowed radius</Text>
                <Text style={styles.geofenceStatVal}>{formatDistance(geofenceError.allowedM)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Active timer card */}
        {isClockedIn ? (
          <LinearGradient colors={['#f0fdf4', '#dcfce7']} style={styles.activeCard}>
            <View style={styles.activeCardHeader}>
              <View style={styles.activePulseDot} />
              <Text style={styles.activeLabel}>Visit in progress</Text>
            </View>
            <Text style={styles.elapsedTime}>{formatElapsed(elapsed)}</Text>
            <Text style={styles.activeSubtitle}>Elapsed time</Text>
          </LinearGradient>
        ) : null}

        {/* Clock In / Out button */}
        {!isClockedIn ? (
          <Pressable
            onPress={handleClockIn}
            disabled={!canClockIn}
            accessibilityRole="button"
            accessibilityLabel="Clock in"
          >
            <LinearGradient
              colors={canClockIn ? ['#1a5fa8', '#0f3d72'] : ['#a8bdd4', '#8ea8bf']}
              style={styles.actionBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.actionBtnIcon}>📍</Text>
              <Text style={styles.actionBtnText}>
                {isLoading
                  ? 'Clocking in…'
                  : geoStatus === 'outside'
                  ? 'Move closer to clock in'
                  : geoStatus === 'requesting' || geoStatus === 'idle'
                  ? 'Acquiring location…'
                  : 'Clock In'}
              </Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleClockOut}
            disabled={!canClockOut}
            accessibilityRole="button"
            accessibilityLabel="Clock out"
          >
            <LinearGradient
              colors={canClockOut ? ['#16a34a', '#15803d'] : ['#86b89a', '#70a080']}
              style={styles.actionBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.actionBtnIcon}>✅</Text>
              <Text style={styles.actionBtnText}>
                {isLoading ? 'Clocking out…' : 'Clock Out'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}

        {geoStatus === 'denied' ? (
          <View style={styles.deniedBox}>
            <Text style={styles.deniedTitle}>Location access required</Text>
            <Text style={styles.deniedNote}>
              EVV compliance requires location access. Enable it in your device Settings.
            </Text>
          </View>
        ) : null}

        {/* EVV compliance note */}
        <View style={styles.evvNote}>
          <Text style={styles.evvNoteIcon}>🔒</Text>
          <Text style={styles.evvNoteText}>
            GPS is captured at clock-in and clock-out for PA EVV compliance.
            {hasGeolock
              ? ` A ${formatDistance(clientGeofenceM)} presence radius is enforced for this client.`
              : ' No radius is configured — location is still recorded.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Hero header
  heroHeader: { paddingBottom: 28 },
  backBtn: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  backText: { color: '#90bde0', fontSize: 15, fontWeight: '700' },
  heroContent: { alignItems: 'center', paddingHorizontal: 24 },
  clientAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#ffffff25',
    borderWidth: 2, borderColor: '#ffffff40',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  clientAvatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  heroClientName: {
    fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 10,
    textShadowColor: '#00000030', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  heroBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  heroServiceBadge: {
    backgroundColor: '#ffffff20', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#ffffff30',
  },
  heroServiceText: { color: '#bfdbfe', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroGeolockBadge: {
    backgroundColor: '#fef3c720', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#fcd34d40',
  },
  heroGeolockText: { color: '#fde68a', fontSize: 11, fontWeight: '700' },
  heroNoGeolockBadge: {
    backgroundColor: '#ffffff12', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  heroNoGeolockText: { color: '#94a3b8', fontSize: 11 },
  heroScheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ffffff15', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  heroScheduleLabel: { color: '#90bde0', fontSize: 12, fontWeight: '600' },
  heroScheduleVal: { color: '#fff', fontSize: 14, fontWeight: '800' },

  scroll: { padding: 20, paddingBottom: 48 },

  // Geo ring
  geoRingOuter: {
    borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 16,
    gap: 10,
  },
  concRing: {
    position: 'absolute', borderRadius: 999, borderWidth: 1,
  },
  concRing3: { width: 220, height: 220, top: 18 },
  concRing2: { width: 170, height: 170, top: 43 },
  concRing1: { width: 130, height: 130, top: 63 },
  geoRingCircle: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
    gap: 2,
  },
  geoRingCircleDot: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 4, borderTopLeftRadius: 60, borderTopRightRadius: 60,
  },
  geoRingDistanceText: {
    fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'],
  },
  geoRingPctText: { fontSize: 10, fontWeight: '700' },
  geoRingIdleText: { fontSize: 13, fontWeight: '700' },
  geoRingLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  geoRingStatusDot: { width: 8, height: 8, borderRadius: 4 },
  geoRingStatusText: { fontSize: 14, fontWeight: '700' },
  geoRingAllowed: { fontSize: 11, color: '#94a3b8', textAlign: 'center' },

  // Geofence banner
  geofenceBanner: {
    backgroundColor: '#fff5f5',
    borderRadius: 16, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: '#fecaca',
  },
  geofenceBannerTitle: { color: '#991b1b', fontWeight: '800', fontSize: 15, marginBottom: 6 },
  geofenceBannerMsg: { color: '#b91c1c', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  geofenceBannerStats: { flexDirection: 'row', alignItems: 'center' },
  geofenceStat: { flex: 1, alignItems: 'center' },
  geofenceStatLabel: { color: '#f87171', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  geofenceStatVal: { color: '#991b1b', fontSize: 18, fontWeight: '900' },
  geofenceStatDivider: { width: 1, height: 32, backgroundColor: '#fecaca' },

  // Active timer
  activeCard: {
    borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#bbf7d0',
    shadowColor: '#16a34a', shadowOpacity: 0.1, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  activeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  activePulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a' },
  activeLabel: { color: '#15803d', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  elapsedTime: {
    color: '#166534', fontSize: 52, fontWeight: '900',
    fontVariant: ['tabular-nums'], lineHeight: 56,
  },
  activeSubtitle: { color: '#4ade80', fontSize: 12, fontWeight: '600', marginTop: 4 },

  // Action button
  actionBtn: {
    borderRadius: 16, height: 62,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  actionBtnIcon: { fontSize: 22 },
  actionBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },

  // Denied
  deniedBox: {
    backgroundColor: '#fff5f5', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#fecaca',
  },
  deniedTitle: { color: '#991b1b', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  deniedNote: { color: '#b91c1c', fontSize: 13, lineHeight: 19 },

  // EVV note
  evvNote: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginTop: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  evvNoteIcon: { fontSize: 14, marginTop: 1 },
  evvNoteText: { flex: 1, color: '#7a98b4', fontSize: 12, lineHeight: 18 },
});
