import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Circle, Marker } from 'react-native-maps';
import { colors, radii } from '../common/tokens';
import { formatDistance } from '../../lib/geofence';

export type GeoStatus = 'idle' | 'requesting' | 'denied' | 'inside' | 'outside';

export interface GeoMapProps {
  clientLat: number;
  clientLng: number;
  radiusM: number;
  geoStatus: GeoStatus;
  distanceM: number | null;
  accuracy: number | null;
  userLat: number | null;
  userLng: number | null;
}

function hexAlpha(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 255).toString(16).padStart(2, '0');
}

export function GeoMap({
  clientLat,
  clientLng,
  radiusM,
  geoStatus,
  distanceM,
  accuracy,
  userLat,
  userLng,
}: GeoMapProps) {
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
      if (now - last < 33) return;
      last = now;
      setPulse({ radius: Math.max(value * radiusM, 0.1), fade: 1 - value });
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
        <Marker coordinate={{ latitude: clientLat, longitude: clientLng }} title="Client location" />
        <Circle
          center={{ latitude: clientLat, longitude: clientLng }}
          radius={pulse.radius}
          strokeColor={`${zoneColor}${hexAlpha(pulse.fade * 0.65)}`}
          strokeWidth={2}
          fillColor={`${zoneColor}${hexAlpha(pulse.fade * 0.18)}`}
          zIndex={1}
        />
        <Circle
          center={{ latitude: clientLat, longitude: clientLng }}
          radius={radiusM}
          strokeColor={zoneColor}
          strokeWidth={3}
          fillColor={`${zoneColor}26`}
          zIndex={2}
        />
      </MapView>

      <View style={styles.mapPill}>
        <View style={[styles.mapPillDot, { backgroundColor: zoneColor }]} />
        <Text style={styles.mapPillText} numberOfLines={1}>{statusLabel}</Text>
        {distanceM != null ? <Text style={styles.mapPillMeta}>· {formatDistance(distanceM)}</Text> : null}
      </View>
      {accuracy != null ? (
        <View style={styles.mapAccuracy}>
          <Text style={styles.mapAccuracyText}>GPS ±{Math.round(accuracy)} m</Text>
        </View>
      ) : null}
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

const styles = StyleSheet.create({
  mapWrap: {
    height: 300,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#e3e9f0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: { flex: 1 },
  mapPill: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(15,28,42,0.82)',
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 8,
  },
  mapPillDot: { width: 9, height: 9, borderRadius: 5 },
  mapPillText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  mapPillMeta: { color: '#cdd9e6', fontSize: 12.5, fontWeight: '600' },
  mapAccuracy: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(15,28,42,0.66)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mapAccuracyText: { color: '#dbe6f1', fontSize: 11, fontWeight: '700' },
  mapControls: { position: 'absolute', right: 12, bottom: 12, gap: 8 },
  mapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mapBtnDisabled: { backgroundColor: '#eef2f6' },
});
