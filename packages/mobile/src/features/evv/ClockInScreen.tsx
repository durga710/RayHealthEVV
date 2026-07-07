import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, {
  FadeIn,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Circle, Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import { haversineM, formatDistance } from '../../lib/geofence';
import { showAppAlert } from '../common/alerts/appAlert';
import { colors, typography, radii, shadow, gradients } from '../common/tokens';

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

// ─── Geo status ───────────────────────────────────────────────────────────────

type GeoStatus = 'idle' | 'requesting' | 'denied' | 'inside' | 'outside';

// Convert a 0..1 opacity into a 2-digit hex alpha suffix for an #rrggbb color.
function hexAlpha(a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  return Math.round(clamped * 255).toString(16).padStart(2, '0');
}

// ─── Live geofence map ────────────────────────────────────────────────────────
// Replaces the abstract distance ring with a real map: the client's address at
// the center, a coloured circle showing the exact geofence the caregiver must
// stay within, and the caregiver's own live location dot.
//
// On top of the solid boundary we render a radar "ping": a translucent ring
// that swells from the centre out to the full radius and fades, looping — so
// the map feels like it's actively scanning for the caregiver. Tinted green
// inside / amber outside so the animation itself signals zone status. Purely
// cosmetic; the inside/outside detection still comes from the GPS distance
// math in the parent. Driven by a JS Animated.Value (react-native-maps Circle
// props can't use the native driver) and throttled to ~30fps to stay smooth
// and easy on the battery.
function GeoMap({
  clientLat,
  clientLng,
  radiusM,
  geoStatus,
  distanceM,
  accuracy,
  userLat,
  userLng,
}: {
  clientLat: number;
  clientLng: number;
  radiusM: number;
  geoStatus: GeoStatus;
  distanceM: number | null;
  accuracy: number | null;
  userLat: number | null;
  userLng: number | null;
}) {
  const isInside = geoStatus === 'inside';
  const isOutside = geoStatus === 'outside';
  const zoneColor = isInside ? '#16a34a' : isOutside ? '#f59e0b' : '#94a3b8';
  const statusLabel = isInside
    ? 'Within allowed zone'
    : isOutside
    ? 'Outside allowed zone'
    : geoStatus === 'denied'
    ? 'Location access denied'
    : 'Acquiring GPS…';
  // Fit the camera tightly to the geofence circle so the map opens framed on
  // the zone — not zoomed out to the whole city. We compute the circle's
  // bounding box (centre ± radius, with ~20% breathing room) and
  // fitToCoordinates onto it once the map is ready; that's exact regardless of
  // screen aspect ratio. initialRegion below is only a close first frame.
  const mapRef = useRef<MapView>(null);
  const padM = radiusM * 1.2;
  const latPad = padM / 111_320;
  const lngPad = padM / (111_320 * Math.cos((clientLat * Math.PI) / 180));
  const delta = Math.max(latPad * 2.4, 0.0025);
  const fitToZone = (animated = false) =>
    mapRef.current?.fitToCoordinates(
      [
        { latitude: clientLat + latPad, longitude: clientLng + lngPad },
        { latitude: clientLat - latPad, longitude: clientLng - lngPad },
      ],
      { edgePadding: { top: 28, right: 28, bottom: 28, left: 28 }, animated },
    );

  const hasUser = userLat != null && userLng != null;
  // Pan to the caregiver. If they're far away, frame both them AND the zone so
  // they can see their position relative to where they need to be; if close,
  // just zoom in on them at the geofence scale.
  const recenterMe = () => {
    if (userLat == null || userLng == null) return;
    if (distanceM != null && distanceM > radiusM * 3) {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: userLat, longitude: userLng },
          { latitude: clientLat, longitude: clientLng },
        ],
        { edgePadding: { top: 56, right: 56, bottom: 90, left: 56 }, animated: true },
      );
    } else {
      mapRef.current?.animateToRegion(
        { latitude: userLat, longitude: userLng, latitudeDelta: delta, longitudeDelta: delta },
        350,
      );
    }
  };

  const progress = useRef(new Animated.Value(0)).current;
  // radius = how far the ping has travelled; fade = 1 at centre → 0 at the edge.
  const [pulse, setPulse] = useState({ radius: 0.1, fade: 0 });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    );
    let last = 0;
    const id = progress.addListener(({ value }) => {
      const now = Date.now();
      if (now - last < 33) return; // ~30fps throttle
      last = now;
      setPulse({
        radius: Math.max(value * radiusM, 0.1),
        fade: 1 - value,
      });
    });
    loop.start();
    return () => {
      loop.stop();
      progress.removeListener(id);
      progress.setValue(0);
    };
  }, [progress, radiusM]);

  return (
    <View style={styles.mapWrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: clientLat,
          longitude: clientLng,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        onMapReady={() => fitToZone()}
        onLayout={() => fitToZone()}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        loadingEnabled
      >
        <Marker
          coordinate={{ latitude: clientLat, longitude: clientLng }}
          title="Client location"
        />
        {/* Radar ping — drawn under the solid boundary (lower zIndex). */}
        <Circle
          center={{ latitude: clientLat, longitude: clientLng }}
          radius={pulse.radius}
          strokeColor={`${zoneColor}${hexAlpha(pulse.fade * 0.65)}`}
          strokeWidth={2}
          fillColor={`${zoneColor}${hexAlpha(pulse.fade * 0.18)}`}
          zIndex={1}
        />
        {/* Solid geofence boundary — always crisp, on top. */}
        <Circle
          center={{ latitude: clientLat, longitude: clientLng }}
          radius={radiusM}
          strokeColor={zoneColor}
          strokeWidth={3}
          fillColor={`${zoneColor}26`}
          zIndex={2}
        />
      </MapView>

      {/* Floating status pill — overlaid on the map instead of a separate card. */}
      <View style={styles.mapPill}>
        <View style={[styles.mapPillDot, { backgroundColor: zoneColor }]} />
        <Text style={styles.mapPillText} numberOfLines={1}>{statusLabel}</Text>
        {distanceM != null ? (
          <Text style={styles.mapPillMeta}>· {formatDistance(distanceM)}</Text>
        ) : null}
      </View>
      {accuracy != null ? (
        <View style={styles.mapAccuracy}>
          <Text style={styles.mapAccuracyText}>GPS ±{Math.round(accuracy)} m</Text>
        </View>
      ) : null}

      {/* Recenter controls — jump to my location or back to the client zone. */}
      <View style={styles.mapControls}>
        <Pressable
          onPress={recenterMe}
          disabled={!hasUser}
          style={({ pressed }) => [styles.mapBtn, !hasUser && styles.mapBtnDisabled, pressed && hasUser && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
        >
          <Ionicons name="locate" size={19} color={hasUser ? colors.brandBlue : colors.disabled} />
        </Pressable>
        <Pressable
          onPress={() => fitToZone(true)}
          style={({ pressed }) => [styles.mapBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Center map on the client zone"
        >
          <Ionicons name="home" size={17} color={colors.brandBlue} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Motion helpers (Reanimated) ──────────────────────────────────────────────

// Live "recording" dot next to "Visit in progress" — gently swells and dims on
// a loop so the running timer reads as alive, not a static badge.
function PulseDot() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 600 }),
      ),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.35 }],
  }));
  return <Reanimated.View style={[styles.timerPulse, style]} />;
}

// Celebration sparkles around the completion check — same pattern as
// AppDialog's SPARKLE_DOTS: tiny dots springing in on a stagger.
// Positions are relative to the 96px doneCheck circle.
const DONE_SPARKLES = [
  { top: -14, left: 6, size: 8, color: colors.amber, delay: 120 },
  { top: -8, left: 86, size: 9, color: colors.brandBlueLight, delay: 200 },
  { top: 40, left: 106, size: 6, color: colors.success, delay: 300 },
  { top: 94, left: 90, size: 8, color: colors.amber, delay: 260 },
  { top: 86, left: -14, size: 7, color: colors.brandBlueLight, delay: 340 },
  { top: 24, left: -18, size: 9, color: colors.success, delay: 160 },
] as const;

function SparkleDot({ top, left, size, color, delay }: {
  top: number; left: number; size: number; color: string; delay: number;
}) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 180 }));
  }, [anim, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ scale: anim.value }],
  }));
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        styles.doneSparkle,
        { top, left, width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ClockInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    assignmentId?: string;
    clientName?: string;
    clientAddress?: string;
    scheduledTime?: string;
    serviceCode?: string;
    clientLat?: string;
    clientLng?: string;
    clientGeofenceM?: string;
    openVisitId?: string;
    clockInTime?: string;
  }>();

  const assignmentId = firstParam(params.assignmentId);
  const clientName = firstParam(params.clientName);
  const clientAddress = firstParam(params.clientAddress);
  const scheduledTime = firstParam(params.scheduledTime);
  const serviceCode = firstParam(params.serviceCode);
  // Open visit handed in by the dashboard so this screen can RESUME an
  // in-progress visit (show the running timer + Clock Out) instead of offering
  // a second clock-in that would duplicate the visit or error server-side.
  const openVisitId = firstParam(params.openVisitId);
  const openClockInTime = firstParam(params.clockInTime);
  const clientLat = params.clientLat ? parseFloat(firstParam(params.clientLat) ?? '') : null;
  const clientLng = params.clientLng ? parseFloat(firstParam(params.clientLng) ?? '') : null;
  // Guard against a "null"/garbage param (e.g. a null geofence stringified by
  // the schedule path) parsing to NaN — which would make `d <= NaN` always
  // false and trap the user permanently outside the zone.
  const parsedGeofence = params.clientGeofenceM ? parseInt(firstParam(params.clientGeofenceM) ?? '', 10) : NaN;
  const clientGeofenceM = Number.isFinite(parsedGeofence) && parsedGeofence > 0 ? parsedGeofence : 150;
  const hasGeolock =
    Number.isFinite(clientLat) && Number.isFinite(clientLng) &&
    clientLat !== null && clientLng !== null;

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  // Seed from the resumable open visit so reopening mid-shift lands on the live
  // timer + Clock Out, not a fresh Clock In.
  const [visit, setVisit] = useState<{ id: string; clockInTime: string } | null>(
    openVisitId && openClockInTime ? { id: openVisitId, clockInTime: openClockInTime } : null,
  );
  const [elapsed, setElapsed] = useState(0);
  const [geofenceError, setGeofenceError] = useState<{
    message: string; distanceM: number; allowedM: number;
  } | null>(null);
  // Set on a successful clock-out → swaps the screen for the themed completion
  // view instead of a bare native alert.
  const [completed, setCompleted] = useState<{
    totalElapsed: number; clockInTime: string; clockOutTime: string;
    // Whether an actual GPS coordinate was captured at clock-out. Drives the
    // confirmation badge so it never claims "GPS verified" for a zeroed fix.
    locationCaptured: boolean;
  } | null>(null);
  const completeAnim = useRef(new Animated.Value(0)).current;

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  const applyFix = useCallback((loc: Location.LocationObject) => {
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
  }, [hasGeolock, clientLat, clientLng, clientGeofenceM]);

  const startWatching = useCallback(async () => {
    setGeoStatus('requesting');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGeoStatus('denied');
      return;
    }
    // Seed with a fast last-known + one-shot fix so the user isn't stuck on
    // "Acquiring location…" while the high-accuracy watch warms up (which can
    // be slow or never fire indoors).
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) applyFix(last);
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      applyFix(fix);
    } catch {
      // Ignore — the watch below is the source of truth once it emits.
    }
    locationSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 4000 },
      applyFix,
    );
  }, [applyFix]);

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

  useEffect(() => {
    if (!completed) { completeAnim.setValue(0); return; }
    Animated.spring(completeAnim, {
      toValue: 1, useNativeDriver: true, friction: 7, tension: 60,
    }).start();
  }, [completed, completeAnim]);

  const handleClockIn = async () => {
    if (!assignmentId) {
      showAppAlert('No visit selected', 'Go back and choose a scheduled visit.', undefined, {
        variant: 'error',
        icon: 'calendar-outline',
      });
      return;
    }
    if (!currentCoords) {
      showAppAlert('Still finding your location', 'Hang tight while we lock onto GPS — this usually takes a few seconds.', undefined, {
        variant: 'info',
        icon: 'locate-outline',
      });
      return;
    }
    setGeofenceError(null);
    setIsLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { data } = await apiClient.post('/api/evv/clock-in', {
        assignmentId,
        ...(serviceCode ? { serviceCode } : {}),
        location: { lat: currentCoords.lat, lng: currentCoords.lng, accuracy: accuracy ?? 0 },
      });
      setVisit({ id: data.id, clockInTime: data.clockInTime ?? new Date().toISOString() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const resp = (err as {
        response?: { status?: number; data?: { code?: string; message?: string; distanceM?: number; allowedM?: number } }
      })?.response;
      if (resp?.status === 422 && resp.data?.code === 'GEOFENCE_OUT_OF_BOUNDS') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setGeofenceError({
          message: resp.data.message ?? 'You are outside the allowed zone.',
          distanceM: resp.data.distanceM ?? 0,
          allowedM: resp.data.allowedM ?? clientGeofenceM,
        });
      } else {
        showAppAlert(
          "Clock-in didn't go through",
          "Something interrupted your check-in. Give it another try — your visit hasn't started yet.",
          undefined,
          { variant: 'error' },
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!visit) return;
    setGeofenceError(null);
    setIsLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // A caregiver must always be able to END a shift. Use the live fix if we
      // have one, otherwise fall back to last-known (they almost certainly had
      // GPS when they clocked in at this client) so a stale/denied watch can't
      // trap them in an open visit.
      let coords = currentCoords;
      let acc = accuracy;
      if (!coords) {
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            coords = { lat: last.coords.latitude, lng: last.coords.longitude };
            acc = last.coords.accuracy ?? null;
          }
        } catch {
          // ignore — send a zeroed location below and let the server decide
        }
      }
      await apiClient.post(`/api/evv/clock-out/${visit.id}`, {
        location: coords
          ? { lat: coords.lat, lng: coords.lng, accuracy: acc ?? 0 }
          : { lat: 0, lng: 0, accuracy: 0 },
      });
      const totalElapsed = elapsed;
      const clockInTime = visit.clockInTime;
      const clockOutTime = new Date().toISOString();
      setVisit(null);
      setCompleted({ totalElapsed, clockInTime, clockOutTime, locationCaptured: Boolean(coords) });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const resp = (err as {
        response?: { status?: number; data?: { code?: string; message?: string; distanceM?: number; allowedM?: number } }
      })?.response;
      if (resp?.status === 422 && resp.data?.code === 'GEOFENCE_OUT_OF_BOUNDS') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setGeofenceError({
          message: resp.data.message ?? 'You are outside the allowed zone.',
          distanceM: resp.data.distanceM ?? 0,
          allowedM: resp.data.allowedM ?? clientGeofenceM,
        });
      } else {
        showAppAlert(
          "Clock-out didn't go through",
          'Something interrupted your check-out. Give it another try — your visit is still open.',
          undefined,
          { variant: 'error' },
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isClockedIn = visit !== null;
  const canClockIn = currentCoords != null && geoStatus === 'inside' && !isLoading;
  // Clock-out is intentionally NOT gated on a live fix — see handleClockOut.
  const canClockOut = isClockedIn && !isLoading;

  const initials = (clientName ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // ── Reusable blocks, ordered differently by visit state below ───────────────

  const clientCard = (
    <View style={styles.card}>
      <View style={styles.clientRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName} numberOfLines={1}>{clientName ?? '—'}</Text>
          {clientAddress ? (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.clientAddr} numberOfLines={2}>{clientAddress}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.chipRow}>
        {serviceCode ? (
          <View style={styles.chip}>
            <Ionicons name="medkit-outline" size={12} color={colors.brandBlue} />
            <Text style={styles.chipText}>{serviceCode}</Text>
          </View>
        ) : null}
        <View style={styles.chip}>
          <Ionicons name="time-outline" size={12} color={colors.brandBlue} />
          <Text style={styles.chipText}>{formatScheduledTime(scheduledTime)}</Text>
        </View>
        {!hasGeolock ? (
          <View style={[styles.chip, styles.chipMuted]}>
            <Text style={styles.chipMutedText}>No geolock</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const mapBlock =
    hasGeolock && clientLat != null && clientLng != null ? (
      <GeoMap
        clientLat={clientLat}
        clientLng={clientLng}
        radiusM={clientGeofenceM}
        geoStatus={geoStatus}
        distanceM={distanceM}
        accuracy={accuracy}
        userLat={currentCoords?.lat ?? null}
        userLng={currentCoords?.lng ?? null}
      />
    ) : null;

  const timerCard = isClockedIn ? (
    <Reanimated.View entering={FadeInDown.springify().damping(16)}>
      <LinearGradient colors={['#ecfdf5', '#d1fae5']} style={styles.timerCard}>
        <View style={styles.timerHeader}>
          <PulseDot />
          <Text style={styles.timerLabel}>Visit in progress</Text>
        </View>
        <Text style={styles.timerValue}>{formatElapsed(elapsed)}</Text>
        <Text style={styles.timerSub}>
          Started {formatScheduledTime(visit?.clockInTime)} · tap Clock Out when done
        </Text>
      </LinearGradient>
    </Reanimated.View>
  ) : null;

  const geofenceBanner = geofenceError ? (
    <Reanimated.View entering={FadeIn.duration(200)} style={styles.geofenceBanner}>
      <Text style={styles.geofenceBannerTitle}>Outside allowed zone</Text>
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
    </Reanimated.View>
  ) : null;

  const actionButton = !isClockedIn ? (
    <Pressable
      onPress={handleClockIn}
      disabled={!canClockIn}
      style={({ pressed }) => [
        styles.actionBtnWrap,
        pressed && canClockIn && { transform: [{ scale: 0.98 }], opacity: 0.95 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Clock in"
    >
      <LinearGradient
        colors={canClockIn ? gradients.cta : gradients.ctaDisabled}
        style={styles.actionBtn}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.onGradient} />
        ) : (
          <Ionicons name="location" size={20} color={colors.onGradient} />
        )}
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
      style={({ pressed }) => [
        styles.actionBtnWrap,
        pressed && canClockOut && { transform: [{ scale: 0.98 }], opacity: 0.95 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Clock out"
    >
      <LinearGradient
        colors={canClockOut ? gradients.ctaSuccess : ['#86b89a', '#70a080']}
        style={styles.actionBtn}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.onGradient} />
        ) : (
          <Ionicons name="checkmark-circle" size={22} color={colors.onGradient} />
        )}
        <Text style={styles.actionBtnText}>{isLoading ? 'Clocking out…' : 'Clock Out'}</Text>
      </LinearGradient>
    </Pressable>
  );

  const deniedBox = geoStatus === 'denied' ? (
    <Reanimated.View entering={FadeIn.duration(200)} style={styles.deniedBox}>
      <Text style={styles.deniedTitle}>Location access required</Text>
      <Text style={styles.deniedNote}>
        {"EVV compliance needs your location to confirm you're at the client's address. Enable it, then tap Retry."}
      </Text>
      <View style={styles.deniedActions}>
        <Pressable
          onPress={() => void startWatching()}
          style={({ pressed }) => [styles.deniedBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Retry location access"
        >
          <Text style={styles.deniedBtnText}>Retry</Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openSettings()}
          style={({ pressed }) => [styles.deniedBtnGhost, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Open device settings"
        >
          <Text style={styles.deniedBtnGhostText}>Open Settings</Text>
        </Pressable>
      </View>
    </Reanimated.View>
  ) : null;

  const evvNote = (
    <View style={styles.evvNote}>
      <Ionicons name="lock-closed" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
      <Text style={styles.evvNoteText}>
        GPS is captured at clock-in and clock-out for PA EVV compliance.
        {hasGeolock
          ? ` A ${formatDistance(clientGeofenceM)} presence radius is enforced for this client.`
          : ' No radius is configured — location is still recorded.'}
      </Text>
    </View>
  );

  // ── Visit complete celebration ──────────────────────────────────────────────
  if (completed) {
    const cardStyle = {
      opacity: completeAnim,
      transform: [
        { scale: completeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
      ],
    };
    const checkStyle = {
      transform: [
        { scale: completeAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.15, 1] }) },
      ],
    };
    return (
      <LinearGradient colors={gradients.hero} style={styles.doneRoot}>
        <StatusBar style="light" />
        <Reanimated.View entering={FadeIn.duration(250)} style={styles.doneContent}>
        <Animated.View style={[styles.doneCard, cardStyle]}>
          <View style={styles.doneCheckWrap}>
            {DONE_SPARKLES.map((dot, i) => (
              <SparkleDot key={i} {...dot} />
            ))}
            <Animated.View style={[styles.doneCheck, checkStyle]}>
              <Ionicons name="checkmark" size={50} color={colors.onGradient} />
            </Animated.View>
          </View>
          <Text style={styles.doneTitle}>Visit Complete</Text>
          {clientName ? <Text style={styles.doneClient}>{clientName}</Text> : null}

          <View style={styles.doneTimeWrap}>
            <Text style={styles.doneTimeLabel}>TOTAL VISIT TIME</Text>
            <Text style={styles.doneTime}>{formatElapsed(completed.totalElapsed)}</Text>
          </View>

          <View style={styles.doneSplit}>
            <View style={styles.doneCol}>
              <Text style={styles.doneColLabel}>Clock in</Text>
              <Text style={styles.doneColVal}>{formatScheduledTime(completed.clockInTime)}</Text>
            </View>
            <View style={styles.doneColDivider} />
            <View style={styles.doneCol}>
              <Text style={styles.doneColLabel}>Clock out</Text>
              <Text style={styles.doneColVal}>{formatScheduledTime(completed.clockOutTime)}</Text>
            </View>
          </View>

          <View style={styles.doneVerified}>
            <Ionicons
              name={completed.locationCaptured ? 'shield-checkmark' : 'alert-circle'}
              size={15}
              color={completed.locationCaptured ? colors.success : colors.amber}
            />
            <Text style={styles.doneVerifiedText}>
              {completed.locationCaptured
                ? 'GPS verified · EVV recorded'
                : 'EVV recorded · location not captured'}
            </Text>
          </View>
        </Animated.View>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
        </Reanimated.View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Slim header — back + geofence pill; client detail lives in the card below */}
      <LinearGradient
        colors={gradients.header}
        style={[styles.topBar, { paddingTop: insets.top + 8 }]}
      >
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#cfe2f5" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {isClockedIn ? (
          <>
            {timerCard}
            {mapBlock}
            {geofenceBanner}
            {clientCard}
            {actionButton}
            {deniedBox}
            {evvNote}
          </>
        ) : (
          <>
            {clientCard}
            {mapBlock}
            {geofenceBanner}
            {actionButton}
            {deniedBox}
            {evvNote}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },

  // Visit complete celebration
  doneRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  doneContent: { width: '100%', alignItems: 'center', gap: 20 },
  doneCard: {
    backgroundColor: colors.cardBg, borderRadius: 28, paddingVertical: 36, paddingHorizontal: 28,
    alignItems: 'center', width: '100%', maxWidth: 380,
    ...shadow.floating,
  },
  doneCheckWrap: { marginBottom: 18 },
  doneSparkle: { position: 'absolute' },
  doneCheck: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.success, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  doneTitle: { ...typography.hero, fontSize: 26, letterSpacing: -0.5, color: colors.textPrimary },
  doneClient: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  doneTimeWrap: { alignItems: 'center', marginTop: 22 },
  doneTimeLabel: { ...typography.label, letterSpacing: 1, color: colors.textMuted },
  doneTime: { fontSize: 46, fontWeight: '900', color: colors.brandBlue, fontVariant: ['tabular-nums'], marginTop: 4, lineHeight: 50 },
  doneSplit: { flexDirection: 'row', alignItems: 'center', marginTop: 18, alignSelf: 'stretch' },
  doneCol: { flex: 1, alignItems: 'center' },
  doneColLabel: { ...typography.label, fontWeight: '700', letterSpacing: 0.5, color: colors.textMuted },
  doneColVal: { ...typography.heading, color: colors.textPrimary, marginTop: 3 },
  doneColDivider: { width: 1, height: 34, backgroundColor: colors.border },
  doneVerified: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22,
    backgroundColor: colors.successBg, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.successBorder,
  },
  doneVerifiedText: { color: colors.successDark, fontSize: 12.5, fontWeight: '700' },
  doneBtn: {
    backgroundColor: colors.cardBg, borderRadius: radii.lg, height: 54,
    width: '100%', maxWidth: 380, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  doneBtnText: { color: colors.brandBlue, fontSize: 17, fontWeight: '800' },

  // Slim header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 4, paddingRight: 8 },
  backText: { color: '#cfe2f5', fontSize: 16, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  // Client card
  card: {
    backgroundColor: colors.cardBg, borderRadius: radii.xl, padding: 16,
    ...shadow.card,
  },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#eaf2fb', borderWidth: 1, borderColor: '#d6e6f7',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900', color: colors.brandBlue },
  clientInfo: { flex: 1, gap: 3 },
  clientName: { ...typography.heading, fontSize: 18, fontWeight: '900', letterSpacing: -0.3, color: colors.textPrimary },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  clientAddr: { flex: 1, fontSize: 12.5, color: colors.textSecondary, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#f0f6fd', borderRadius: radii.pill,
    paddingHorizontal: 11, paddingVertical: 6,
    borderWidth: 1, borderColor: '#e0ecf8',
  },
  chipText: { fontSize: 12, fontWeight: '800', color: colors.brandBlue, letterSpacing: 0.2 },
  chipMuted: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  chipMutedText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },

  // Live geofence map + floating status pill
  mapWrap: {
    height: 300, borderRadius: radii.xl, overflow: 'hidden',
    backgroundColor: '#e3e9f0', borderWidth: 1, borderColor: colors.border,
  },
  map: { flex: 1 },
  mapPill: {
    position: 'absolute', left: 12, bottom: 12, maxWidth: '85%',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(15,28,42,0.82)', borderRadius: 999,
    paddingLeft: 12, paddingRight: 14, paddingVertical: 8,
  },
  mapPillDot: { width: 9, height: 9, borderRadius: 5 },
  mapPillText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  mapPillMeta: { color: '#cdd9e6', fontSize: 12.5, fontWeight: '600' },
  mapAccuracy: {
    position: 'absolute', right: 12, top: 12,
    backgroundColor: 'rgba(15,28,42,0.66)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  mapAccuracyText: { color: '#dbe6f1', fontSize: 11, fontWeight: '700' },
  mapControls: { position: 'absolute', right: 12, bottom: 12, gap: 8 },
  mapBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardBg,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  mapBtnDisabled: { backgroundColor: '#eef2f6' },

  // Active timer (green-tinted shadow is intentional — matches the timer surface)
  timerCard: {
    borderRadius: radii.xl, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#a7f3d0',
    shadowColor: colors.success, shadowOpacity: 0.12, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  timerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  timerPulse: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  timerLabel: { ...typography.label, letterSpacing: 1, fontSize: 12, color: colors.successDark },
  timerValue: { color: '#166534', fontSize: 54, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 58 },
  timerSub: { color: '#3f9d6b', fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },

  // Geofence banner
  geofenceBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: radii.lg, padding: 18,
    borderWidth: 1, borderColor: colors.dangerBorder,
  },
  geofenceBannerTitle: { color: colors.dangerDark, fontWeight: '800', fontSize: 15, marginBottom: 6 },
  geofenceBannerMsg: { ...typography.sub, color: colors.danger, lineHeight: 19, marginBottom: 14 },
  geofenceBannerStats: { flexDirection: 'row', alignItems: 'center' },
  geofenceStat: { flex: 1, alignItems: 'center' },
  geofenceStatLabel: { ...typography.label, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: '#f87171', marginBottom: 3 },
  geofenceStatVal: { color: colors.dangerDark, fontSize: 18, fontWeight: '900' },
  geofenceStatDivider: { width: 1, height: 32, backgroundColor: colors.dangerBorder },

  // Action button
  actionBtnWrap: { borderRadius: radii.lg },
  actionBtn: {
    borderRadius: radii.lg, height: 60,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    shadowColor: colors.brandBlueDark, shadowOpacity: 0.25, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  actionBtnText: { color: colors.onGradient, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },

  // Denied
  deniedBox: {
    backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: 14,
    borderWidth: 1, borderColor: colors.dangerBorder,
  },
  deniedTitle: { color: colors.dangerDark, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  deniedNote: { ...typography.sub, color: colors.danger, lineHeight: 19 },
  deniedActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  deniedBtn: { backgroundColor: colors.danger, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 9 },
  deniedBtnText: { ...typography.sub, fontWeight: '800', color: colors.onGradient },
  deniedBtnGhost: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 9 },
  deniedBtnGhostText: { ...typography.sub, fontWeight: '800', color: colors.danger },

  // EVV note
  evvNote: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: colors.cardBg, borderRadius: radii.md, padding: 14,
    ...shadow.subtle,
  },
  evvNoteText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
