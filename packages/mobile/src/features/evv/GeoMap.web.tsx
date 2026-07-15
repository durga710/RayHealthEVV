import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../common/tokens';
import { formatDistance } from '../../lib/geofence';
import type { GeoMapProps, GeoStatus } from './GeoMap.native';

export type { GeoStatus };

export function GeoMap({ geoStatus, distanceM, accuracy, radiusM }: GeoMapProps) {
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

  return (
    <View style={styles.wrap} accessibilityLabel={`Geofence status: ${statusLabel}`}>
      <View style={[styles.zone, { borderColor: zoneColor, backgroundColor: `${zoneColor}18` }]}>
        <View style={[styles.center, { backgroundColor: zoneColor }]} />
      </View>
      <Text style={styles.title}>{statusLabel}</Text>
      <Text style={styles.detail}>
        {distanceM != null ? `${formatDistance(distanceM)} from client · ` : ''}
        {formatDistance(radiusM)} allowed radius
        {accuracy != null ? ` · GPS ±${Math.round(accuracy)} m` : ''}
      </Text>
      <Text style={styles.note}>The live map is available in the iOS and Android app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 300,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf3f8',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
  },
  zone: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  center: { width: 18, height: 18, borderRadius: 9 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  detail: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  note: { color: colors.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' },
});
