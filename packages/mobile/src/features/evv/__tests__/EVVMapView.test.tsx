import React from 'react';
import { render, screen } from '@testing-library/react-native';
import EVVMapView from '../EVVMapView';

// Haversine distance calculation extracted for unit testing
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

describe('Haversine distance calculation', () => {
  const clientLat = 40.4659;
  const clientLng = -79.8358;

  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(clientLat, clientLng, clientLat, clientLng)).toBe(0);
  });

  it('calculates short distance correctly (~100m)', () => {
    // Move ~100m north (approx 0.0009 degrees latitude)
    const dist = haversineDistance(clientLat, clientLng, clientLat + 0.0009, clientLng);
    expect(dist).toBeGreaterThan(80);
    expect(dist).toBeLessThan(120);
  });

  it('detects inside geofence (150m)', () => {
    const dist = haversineDistance(clientLat, clientLng, clientLat + 0.0005, clientLng);
    expect(dist).toBeLessThanOrEqual(150);
  });

  it('detects outside geofence (150m)', () => {
    const dist = haversineDistance(clientLat, clientLng, clientLat + 0.002, clientLng);
    expect(dist).toBeGreaterThan(150);
  });

  it('handles large distances', () => {
    // Pittsburgh to NYC approx 489 km
    const dist = haversineDistance(40.4659, -79.8358, 40.7128, -74.006);
    expect(dist).toBeGreaterThan(400000);
    expect(dist).toBeLessThan(600000);
  });
});

describe('EVVMapView', () => {
  it('renders without crashing when caregiver location is null', () => {
    render(
      <EVVMapView
        caregiverLat={null}
        caregiverLng={null}
        clientLat={40.4659}
        clientLng={-79.8358}
        geofenceRadiusMeters={150}
      />
    );

    expect(screen.getByText(/Waiting for GPS/i)).toBeTruthy();
  });

  it('shows geofence status when caregiver is inside radius', () => {
    render(
      <EVVMapView
        caregiverLat={40.4659}
        caregiverLng={-79.8358}
        clientLat={40.4659}
        clientLng={-79.8358}
        geofenceRadiusMeters={150}
      />
    );

    expect(screen.getByText(/INSIDE/i)).toBeTruthy();
  });

  it('shows outside status when caregiver is far away', () => {
    render(
      <EVVMapView
        caregiverLat={40.47}
        caregiverLng={-79.84}
        clientLat={40.4659}
        clientLng={-79.8358}
        geofenceRadiusMeters={150}
      />
    );

    expect(screen.getByText(/OUTSIDE/i)).toBeTruthy();
  });
});
