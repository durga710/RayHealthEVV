import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EVVMapViewProps {
  caregiverLat: number | null;
  caregiverLng: number | null;
  clientLat: number;
  clientLng: number;
  geofenceRadiusMeters: number;
}

export default function EVVMapView({
  caregiverLat,
  caregiverLng,
  clientLat,
  clientLng,
  geofenceRadiusMeters,
}: EVVMapViewProps) {
  // Haversine formula to compute exact distance in meters
  const distance = useMemo(() => {
    if (caregiverLat === null || caregiverLng === null) return null;
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (clientLat * Math.PI) / 180;
    const phi2 = (caregiverLat * Math.PI) / 180;
    const deltaPhi = ((caregiverLat - clientLat) * Math.PI) / 180;
    const deltaLambda = ((caregiverLng - clientLng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }, [caregiverLat, caregiverLng, clientLat, clientLng]);

  const isInsideGeofence = distance !== null && distance <= geofenceRadiusMeters;

  // Pixel layout conversions at Zoom 15 (approx. 2 meters per pixel at lat 40.46)
  const metersPerPixel = 2.0;
  const mapWidth = Dimensions.get('window').width - 32; // match padding
  const mapHeight = 220;

  // Geofence circle pixel dimensions
  const geofencePixelSize = Math.round((geofenceRadiusMeters * 2) / metersPerPixel); // approx 150px at radius 150m

  // Caregiver offset relative to center of the map (Client)
  const caregiverOffset = useMemo(() => {
    if (caregiverLat === null || caregiverLng === null) return { x: 0, y: 0 };
    const latDegreeToMeters = 111111;
    const lngDegreeToMeters = 111111 * Math.cos((clientLat * Math.PI) / 180);

    const deltaYMeters = (caregiverLat - clientLat) * latDegreeToMeters;
    const deltaXMeters = (caregiverLng - clientLng) * lngDegreeToMeters;

    // Convert to pixel offsets
    let offsetX = deltaXMeters / metersPerPixel;
    let offsetY = -deltaYMeters / metersPerPixel; // Y goes down on screen

    // Constrain offset inside map frame boundaries
    const maxOffsetX = mapWidth / 2 - 16;
    const maxOffsetY = mapHeight / 2 - 16;

    offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
    offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));

    return { x: offsetX, y: offsetY };
  }, [caregiverLat, caregiverLng, clientLat, clientLng, mapWidth]);

  // Pull beautiful, high-contrast, free static street map tile centered on client
  const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${clientLng},${clientLat}&size=450,220&z=15&l=map&lang=en_US`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.signalRow}>
          <View style={[styles.signalDot, { backgroundColor: caregiverLat ? '#22c55e' : '#fb923c' }]} />
          <Text style={styles.signalText}>
            {caregiverLat ? 'GPS ACTIVE (HIGH ACCURACY)' : 'AWAITING SATELLITE FIX...'}
          </Text>
        </View>
        <Text style={styles.coordinates}>
          {caregiverLat && caregiverLng
            ? `${caregiverLat.toFixed(5)}° N, ${Math.abs(caregiverLng).toFixed(5)}° W`
            : 'SEARCHING FOR COORDINATES...'}
        </Text>
      </View>

      {/* Map Frame */}
      <View style={[styles.mapFrame, { width: mapWidth, height: mapHeight }]}>
        <Image
          source={{ uri: staticMapUrl }}
          style={styles.mapImage}
          resizeMode="cover"
        />

        {/* Center Geofence Circle Overlay */}
        <View
          style={[
            styles.geofenceCircle,
            {
              width: geofencePixelSize,
              height: geofencePixelSize,
              borderRadius: geofencePixelSize / 2,
              borderColor: isInsideGeofence ? '#22c55e' : '#f97316',
              backgroundColor: isInsideGeofence ? 'rgba(34, 197, 94, 0.12)' : 'rgba(249, 115, 22, 0.12)',
            },
          ]}
        />

        {/* Center Client Pin */}
        <View style={styles.clientPin}>
          <Ionicons name="home" size={20} color="#1a5fa8" />
          <View style={styles.clientLabelContainer}>
            <Text style={styles.clientLabel}>CLIENT HOME</Text>
          </View>
        </View>

        {/* Caregiver Dynamic Pin */}
        {caregiverLat !== null && (
          <View
            style={[
              styles.caregiverPin,
              {
                transform: [
                  { translateX: caregiverOffset.x },
                  { translateY: caregiverOffset.y },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.pulseRing,
                { backgroundColor: isInsideGeofence ? 'rgba(34, 197, 94, 0.4)' : 'rgba(249, 115, 22, 0.4)' },
              ]}
            />
            <Ionicons
              name="person-circle"
              size={28}
              color={isInsideGeofence ? '#22c55e' : '#f97316'}
            />
          </View>
        )}
      </View>

      {/* HUD Info Section */}
      <View style={styles.hudContainer}>
        <View style={styles.hudStat}>
          <Text style={styles.hudLabel}>GEOFENCE RANGE</Text>
          <Text style={styles.hudValue}>{geofenceRadiusMeters} meters</Text>
        </View>

        <View style={styles.hudStat}>
          <Text style={styles.hudLabel}>ESTIMATED DISTANCE</Text>
          <Text style={[styles.hudValue, { color: isInsideGeofence ? '#22c55e' : '#f97316' }]}>
            {distance !== null ? `${distance} meters` : 'Calculating...'}
          </Text>
        </View>

        <View style={styles.hudStat}>
          <Text style={styles.hudLabel}>STATUS</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: isInsideGeofence ? '#d1fae5' : '#ffedd5' },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isInsideGeofence ? '#065f46' : '#9a3412' },
              ]}
            >
              {isInsideGeofence ? 'VERIFIED IN RANGE' : 'OUT OF BOUNDS'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  signalText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  coordinates: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1a5fa8',
    fontFamily: 'monospace',
  },
  mapFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c9d8e8',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  geofenceCircle: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  clientPin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  clientLabelContainer: {
    backgroundColor: 'rgba(18, 72, 160, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  clientLabel: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  caregiverPin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    opacity: 0.4,
  },
  hudContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f4f8',
    paddingTop: 10,
  },
  hudStat: {
    alignItems: 'center',
    flex: 1,
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  hudValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a3a5c',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
