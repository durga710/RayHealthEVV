import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../lib/api-client';
import EVVMapView from './EVVMapView';

// PA Task duty codes as advertised (PA DHS EVV requirements)
interface PATask {
  id: string;
  code: string;
  label: string;
  description: string;
}

const PA_DUTY_TASKS: PATask[] = [
  { id: '106', code: '106', label: 'Personal Care', description: 'Assistance with bathing, dressing, grooming' },
  { id: '108', code: '108', label: 'Meal Preparation', description: 'Cooking, serving and dietary support' },
  { id: '120', code: '120', label: 'Light Housekeeping', description: 'Cleaning client areas, dusting, trash' },
  { id: '202', code: '202', label: 'Respite Care', description: 'Advisory supervision and companion support' },
];

export default function ClockInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    assignmentId?: string;
    clientName?: string;
    scheduledTime?: string;
  }>();

  const assignmentId = typeof params.assignmentId === 'string' ? params.assignmentId : undefined;
  const clientName = typeof params.clientName === 'string' ? params.clientName : undefined;
  const scheduledTime = typeof params.scheduledTime === 'string' ? params.scheduledTime : undefined;

  const [isLoading, setIsLoading] = useState(false);
  const [visit, setVisit] = useState<{ id: string } | null>(null);

  // Live coordinate states
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // PA Task Attestation states
  const [selectedTasks, setSelectedTasks] = useState<Record<string, boolean>>({});

  // Client Fixture Coordinates (centered on seed coordinates)
  const clientLat = 40.4659;
  const clientLng = -79.8358;
  const geofenceRadiusMeters = 150;

  // Watch caregiver position live
  useEffect(() => {
    let active = true;

    async function startWatching() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'RayHealth EVV requires high-accuracy GPS coordinates for PA DHS regulatory compliance.');
        return;
      }

      try {
        // Watch coordinate updates in real time
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 2,
          },
          (location) => {
            if (active) {
              setCoords({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                accuracy: location.coords.accuracy,
              });
            }
          }
        );
        locationSubscriptionRef.current = sub;
      } catch (err) {
        console.error('Failed to watch location', err);
      }
    }

    startWatching();

    return () => {
      active = false;
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
    };
  }, []);

  const handleClockIn = async () => {
    if (!assignmentId) {
      Alert.alert('Select a visit first', 'Choose a scheduled visit from the cockpit before clocking in.');
      return;
    }

    setIsLoading(true);

    try {
      // Pull final high accuracy spot fix
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const payload = {
        assignmentId,
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
        },
      };

      const { data } = await apiClient.post('/api/evv/clock-in', payload);
      setVisit(data);
      setSelectedTasks({}); // Reset checked tasks
      Alert.alert('Clock-In Verified', 'Successfully clocked into Pennsylvania DHS home visit.');
    } catch (error) {
      console.error('Clock-in failed', error);
      Alert.alert('Clock-In Exception', 'Drift detected or server unavailable. Please try again or use telephony backup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!visit) return;

    // Validate PA Duty attestation tasks
    const hasSelectedTask = Object.values(selectedTasks).some((v) => v);
    if (!hasSelectedTask) {
      Alert.alert(
        'Duty Codes Required',
        'Pennsylvania DHS regulations require documenting completed tasks. Please check off at least one PA Duty Code before clocking out.',
        [{ text: 'Understand' }]
      );
      return;
    }

    setIsLoading(true);

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const payload = {
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
        },
        tasks: Object.keys(selectedTasks).filter((id) => selectedTasks[id]),
      };

      await apiClient.post(`/api/evv/clock-out/${visit.id}`, payload);
      setVisit(null);
      setSelectedTasks({});
      Alert.alert('Clock-Out Success', 'Visit completed and securely stored in append-only audit event ledger.');
      router.replace('/dashboard');
    } catch (error) {
      console.error('Clock-out failed', error);
      Alert.alert('Clock-Out Error', 'Failed to transmit clock-out payload. Your actions are saved in the offline queue.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setSelectedTasks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      {/* Geolocation Map Pinpoint Component */}
      <EVVMapView
        caregiverLat={coords ? coords.lat : null}
        caregiverLng={coords ? coords.lng : null}
        clientLat={clientLat}
        clientLng={clientLng}
        geofenceRadiusMeters={geofenceRadiusMeters}
      />

      {/* Selected Visit Context Card */}
      {!assignmentId ? (
        <View style={styles.card}>
          <Ionicons name="alert-circle" size={44} color="#f97316" style={styles.cardIcon} />
          <Text style={styles.cardTitle}>No Active Visit Selected</Text>
          <Text style={styles.cardBody}>
            Select an authorized visit from the schedule cockpit to attach EVV GPS and duty records correctly.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/dashboard')}>
            <Text style={styles.primaryButtonText}>Go to Cockpit</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <Text style={styles.cardLabel}>AUTHORIZED CARE PLAN</Text>
            <View style={[styles.statusBadge, { backgroundColor: visit ? 'rgba(34, 197, 94, 0.15)' : 'rgba(45, 125, 210, 0.15)' }]}>
              <Text style={[styles.statusBadgeText, { color: visit ? '#065f46' : '#1248a0' }]}>
                {visit ? 'VISIT IN PROGRESS' : 'READY TO WORK'}
              </Text>
            </View>
          </View>
          <Text style={styles.clientName}>{clientName || 'Scheduled client'}</Text>
          <Text style={styles.scheduledTime}>
            <Ionicons name="calendar-outline" size={14} color="#5b8fc9" /> {scheduledTime || 'Time not specified'}
          </Text>
          <Text style={styles.address}>
            <Ionicons name="pin-outline" size={14} color="#5b8fc9" /> 225 National Dr, Pittsburgh PA 15235
          </Text>
        </View>
      )}

      {/* Active Session PA Task Attestation */}
      {visit && (
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>PA DUTY CODES ATTESTATION</Text>
          <Text style={styles.sectionLead}>Check off each home assistance duty delivered during this visit.</Text>
          <View style={styles.taskList}>
            {PA_DUTY_TASKS.map((task) => {
              const checked = !!selectedTasks[task.id];
              return (
                <Pressable
                  key={task.id}
                  style={[styles.taskItem, checked && styles.taskItemChecked]}
                  onPress={() => toggleTask(task.id)}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Ionicons name="checkmark" size={16} color="white" />}
                  </View>
                  <View style={styles.taskText}>
                    <Text style={[styles.taskLabel, checked && styles.taskLabelChecked]}>
                      Task {task.code}: {task.label}
                    </Text>
                    <Text style={styles.taskDesc}>{task.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Primary Action Buttons */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#f97316" style={styles.loader} />
      ) : (
        <View style={styles.buttonContainer}>
          {!visit && assignmentId ? (
            <Pressable style={styles.clockInButton} onPress={handleClockIn}>
              <Ionicons name="log-in" size={20} color="white" style={styles.btnIcon} />
              <Text style={styles.buttonText}>VERIFY & CLOCK IN</Text>
            </Pressable>
          ) : visit ? (
            <Pressable style={styles.clockOutButton} onPress={handleClockOut}>
              <Ionicons name="log-out" size={20} color="white" style={styles.btnIcon} />
              <Text style={styles.buttonText}>COMPLETE & CLOCK OUT</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Immutable Ledger Warning */}
      <View style={styles.ledgerWarning}>
        <Ionicons name="shield-checkmark" size={14} color="#5b8fc9" />
        <Text style={styles.ledgerText}>
          RayHealth compliance logs are cryptographically sealed in our audit ledger.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  container: {
    padding: 16,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardIcon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1a3a5c',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  clientName: {
    color: '#1a3a5c',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  scheduledTime: {
    color: '#1a5fa8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  address: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionLead: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  taskList: {
    gap: 10,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  taskItemChecked: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: 'rgba(34, 197, 94, 0.03)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  taskText: {
    flex: 1,
  },
  taskLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1a3a5c',
  },
  taskLabelChecked: {
    color: '#166534',
  },
  taskDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: '#1a5fa8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 16,
  },
  clockInButton: {
    backgroundColor: '#1a5fa8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  clockOutButton: {
    backgroundColor: '#f97316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  btnIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  loader: {
    marginVertical: 20,
  },
  ledgerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 8,
    opacity: 0.8,
  },
  ledgerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5b8fc9',
    textAlign: 'center',
    flex: 1,
  },
});
