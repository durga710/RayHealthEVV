import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import { requestClockReminderPermission } from '../../services/clockReminderService';

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

  const handleClockIn = async () => {
    if (!assignmentId) {
      Alert.alert('Select a visit first', 'Choose a scheduled visit from the dashboard before clocking in.');
      return;
    }

    setIsLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location access is required for EVV.');
      setIsLoading(false);
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const payload = {
        assignmentId,
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
        }
      };

      const { data } = await apiClient.post('/api/evv/clock-in', payload);
      setVisit(data);
      Alert.alert('Success', 'Clocked in successfully!');
      // Request clock-reminder notification permission on first clock-in.
      // Deferred until genuine use (per Apple HIG and project convention).
      void requestClockReminderPermission();
    } catch (error) {
      console.error('Clock-in failed', error);
      Alert.alert('Error', 'Failed to clock in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClockOut = async () => {
    if (!visit) return;
    setIsLoading(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location access is required for EVV.');
      setIsLoading(false);
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const payload = {
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
        }
      };

      await apiClient.post(`/api/evv/clock-out/${visit.id}`, payload);
      setVisit(null);
      Alert.alert('Success', 'Clocked out successfully!');
    } catch (error) {
      console.error('Clock-out failed', error);
      Alert.alert('Error', 'Failed to clock out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EVV Visit</Text>
      {!assignmentId ? (
        <View style={styles.assignmentCard}>
          <Text style={styles.assignmentTitle}>No visit selected</Text>
          <Text style={styles.assignmentBody}>
            Select a scheduled visit from the dashboard so EVV can attach your clock-in to the correct client and authorization.
          </Text>
          <Button title="Go to Dashboard" onPress={() => router.replace('/dashboard')} />
        </View>
      ) : (
        <View style={styles.assignmentCard}>
          <Text style={styles.assignmentLabel}>Selected Visit</Text>
          <Text style={styles.assignmentTitle}>{clientName || 'Scheduled client'}</Text>
          <Text style={styles.assignmentBody}>{scheduledTime || 'Time not specified'}</Text>
        </View>
      )}
      {isLoading ? (
        <ActivityIndicator size="large" color="#1a5fa8" />
      ) : (
        <View style={styles.buttonContainer}>
          {!visit && assignmentId ? (
            <Button title="Clock In" onPress={handleClockIn} />
          ) : visit ? (
            <Button title="Clock Out" onPress={handleClockOut} color="#f97316"/>
          ) : (
            null
          )}
        </View>
      )}
      {visit && (
        <Text style={styles.statusText}>
          Current Status: Clocked In
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4f8', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a3a5c', marginBottom: 24 },
  assignmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 24,
    padding: 20,
    width: '100%'
  },
  assignmentLabel: { color: '#1a5fa8', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  assignmentTitle: { color: '#1a3a5c', fontSize: 20, fontWeight: '700', marginTop: 6 },
  assignmentBody: { color: '#475569', fontSize: 15, lineHeight: 22, marginVertical: 12 },
  buttonContainer: { width: '80%' },
  statusText: { marginTop: 20, fontSize: 16, color: '#5b8fc9' },
});
