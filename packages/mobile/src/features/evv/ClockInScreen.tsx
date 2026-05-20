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

/** Haversine distance in metres — mirrors the server-side formula. */
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
  const isRequesting = status === 'requesting';

  const ringColor = isInside ? '#16a34a' : isOutside ? '#ef4444' : '#c9d8e8';
  const bgColor = isInside ? '#f0fdf4' : isOutside ? '#fef2f2' : '#f8fafc';
  const dotColor = isInside ? '#16a34a' : isOutside ? '#ef4444' : '#9ab0c8';

  return (
    <View style={[styles.geoRingWrap, { backgroundColor: bgColor, borderColor: ringColor }]}>
      {/* Centre dot */}
      <View style={[styles.geoRingDot, { backgroundColor: dotColor }]} />

      {/* Status text */}
      {status === 'idle' || status === 'requesting' ? (
        <Text style={styles.geoRingIdle}>
          {isRequesting ? 'Locating you…' : 'Waiting for GPS'}
        </Text>
      ) : status === 'denied' ? (
        <>
          <Text style={styles.geoRingLabel}>Location denied</Text>
          <Text style={styles.geoRingSub}>Enable in Settings to clock in</Text>
        </>
      ) : (
        <>
          <Text style={[styles.geoRingDistance, { color: ringColor }]}>
            {distanceM != null ? formatDistance(distanceM) : '—'}
          </Text>
          <Text style={[styles.geoRingLabel, { color: ringColor }]}>
            {isInside ? '✓ Within zone' : '✗ Outside zone'}
          </Text>
          <Text style={styles.geoRingAllowed}>
            Allowed radius: {formatDistance(allowedM)}
          </Text>
          {accuracy != null && (
            <Text style={styles.geoRingAccuracy}>GPS ±{Math.round(accuracy)} m</Text>
          )}
        </>
      )}
    </View>
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
  const hasGeolock = Number.isFinite(clientLat) && Number.isFinite(clientLng) && clientLat !== null && clientLng !== null;

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [visit, setVisit] = useState<{ id: string; clockInTime: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [geofenceError, setGeofenceError] = useState<{ message: string; distanceM: number; allowedM: number } | null>(null);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // Start watching GPS as soon as the screen opens
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
          setGeoStatus('inside'); // No geofence configured — allow
        }
      }
    );
  }, [hasGeolock, clientLat, clientLng, clientGeofenceM]);

  useEffect(() => {
    void startWatching();
    return () => { locationSubRef.current?.remove(); };
  }, [startWatching]);

  // Elapsed timer when clocked in
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
      Alert.alert('No GPS signal', 'Wait for your location to be acquired before clocking in.');
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
      const resp = (err as { response?: { status?: number; data?: { code?: string; message?: string; distanceM?: number; allowedM?: number } } })?.response;
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
        'Visit complete',
        `Total visit time: ${formatElapsed(totalElapsed)}`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { code?: string; message?: string; distanceM?: number; allowedM?: number } } })?.response;
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
  const canClockIn = currentCoords != null && (geoStatus === 'inside') && !isLoading;
  const canClockOut = isClockedIn && currentCoords != null && !isLoading;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        {/* Visit info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>CLIENT</Text>
          <Text style={styles.clientName}>{clientName ?? '—'}</Text>
          <View style={styles.metaRow}>
            {serviceCode ? (
              <View style={styles.serviceCodeBadge}>
                <Text style={styles.serviceCodeText}>{serviceCode}</Text>
              </View>
            ) : null}
            {hasGeolock ? (
              <View style={styles.geolockBadge}>
                <Text style={styles.geolockBadgeText}>📍 Geolock active</Text>
              </View>
            ) : (
              <View style={styles.noGeolockBadge}>
                <Text style={styles.noGeolockBadgeText}>No geolock</Text>
              </View>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Scheduled</Text>
            <Text style={styles.infoVal}>{formatScheduledTime(scheduledTime)}</Text>
          </View>
        </View>

        {/* Geo-ring */}
        <GeoRing
          status={geoStatus}
          distanceM={distanceM}
          allowedM={clientGeofenceM}
          accuracy={accuracy}
        />

        {/* Geofence violation banner */}
        {geofenceError ? (
          <View style={styles.geofenceBanner}>
            <Text style={styles.geofenceBannerTitle}>Outside allowed zone</Text>
            <Text style={styles.geofenceBannerMsg}>{geofenceError.message}</Text>
            <Text style={styles.geofenceBannerSub}>
              You are {formatDistance(geofenceError.distanceM)} away •{' '}
              Allowed: {formatDistance(geofenceError.allowedM)}
            </Text>
          </View>
        ) : null}

        {/* Active visit timer */}
        {isClockedIn ? (
          <View style={styles.activeCard}>
            <View style={styles.activePulse} />
            <View>
              <Text style={styles.activeLabel}>Visit in progress</Text>
              <Text style={styles.elapsedTime}>{formatElapsed(elapsed)}</Text>
            </View>
          </View>
        ) : null}

        {/* Clock In / Out button */}
        {!isClockedIn ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.clockInBtn,
              !canClockIn && styles.actionBtnDisabled,
              pressed && canClockIn && { opacity: 0.85 },
            ]}
            onPress={handleClockIn}
            disabled={!canClockIn}
            accessibilityRole="button"
            accessibilityLabel="Clock in"
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
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.clockOutBtn,
              !canClockOut && styles.actionBtnDisabled,
              pressed && canClockOut && { opacity: 0.85 },
            ]}
            onPress={handleClockOut}
            disabled={!canClockOut}
            accessibilityRole="button"
            accessibilityLabel="Clock out"
          >
            <Text style={styles.actionBtnIcon}>✅</Text>
            <Text style={styles.actionBtnText}>
              {isLoading ? 'Clocking out…' : 'Clock Out'}
            </Text>
          </Pressable>
        )}

        {geoStatus === 'denied' ? (
          <Text style={styles.deniedNote}>
            Location access is required for EVV compliance. Enable it in your device Settings.
          </Text>
        ) : null}

        <View style={styles.evvNote}>
          <Text style={styles.evvNoteText}>
            GPS coordinates are captured at clock-in and clock-out for Pennsylvania EVV compliance.
            {hasGeolock
              ? ` Geolock enforces a ${formatDistance(clientGeofenceM)} presence radius.`
              : ' No geolock is configured for this client — location is still recorded.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PRIMARY = '#1a5fa8';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  scroll: { padding: 20, paddingBottom: 48 },

  backBtn: { marginBottom: 20 },
  backText: { color: PRIMARY, fontSize: 15, fontWeight: '600' },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  infoLabel: {
    fontSize: 10, fontWeight: '700', color: '#9ab0c8',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
  },
  clientName: { fontSize: 26, fontWeight: '800', color: '#1a3a5c', marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  serviceCodeBadge: {
    backgroundColor: '#e8f0fa', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  serviceCodeText: { color: PRIMARY, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  geolockBadge: {
    backgroundColor: '#fef3c7', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  geolockBadgeText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
  noGeolockBadge: {
    backgroundColor: '#f3f4f6', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  noGeolockBadgeText: { color: '#9ca3af', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#e8edf2', marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoKey: { color: '#6b8aa6', fontSize: 14 },
  infoVal: { color: '#1a3a5c', fontSize: 14, fontWeight: '600' },

  // Geo-ring
  geoRingWrap: {
    borderRadius: 16, borderWidth: 2,
    padding: 24, alignItems: 'center', marginBottom: 16,
    gap: 8,
  },
  geoRingDot: { width: 14, height: 14, borderRadius: 7 },
  geoRingDistance: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  geoRingLabel: { fontSize: 16, fontWeight: '700' },
  geoRingAllowed: { fontSize: 12, color: '#6b8aa6' },
  geoRingAccuracy: { fontSize: 11, color: '#9ab0c8' },
  geoRingIdle: { fontSize: 15, color: '#9ab0c8', fontStyle: 'italic' },
  geoRingSub: { fontSize: 12, color: '#9ab0c8', textAlign: 'center' },

  // Geofence violation banner
  geofenceBanner: {
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 16,
    marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#ef4444',
  },
  geofenceBannerTitle: { color: '#991b1b', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  geofenceBannerMsg: { color: '#b91c1c', fontSize: 13, lineHeight: 19, marginBottom: 6 },
  geofenceBannerSub: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  // Active timer
  activeCard: {
    backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  activePulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#16a34a' },
  activeLabel: { color: '#15803d', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  elapsedTime: {
    color: '#166534', fontSize: 32, fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Action buttons
  actionBtn: {
    borderRadius: 14, height: 64,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    marginBottom: 16, shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  clockInBtn: { backgroundColor: PRIMARY, shadowColor: PRIMARY },
  clockOutBtn: { backgroundColor: '#16a34a', shadowColor: '#16a34a' },
  actionBtnDisabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  actionBtnIcon: { fontSize: 22 },
  actionBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },

  deniedNote: {
    color: '#ef4444', fontSize: 13, textAlign: 'center',
    marginBottom: 16, paddingHorizontal: 8,
  },
  evvNote: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#c9d8e8',
  },
  evvNoteText: { color: '#6b8aa6', fontSize: 12, lineHeight: 18 },
});
