import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
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
  const [visit, setVisit] = useState<{ id: string } | null>(null);

  const handleClockIn = async () => {
    if (!assignmentId) {
      Alert.alert('Select a visit', 'Choose a scheduled visit before clocking in.', [
        { text: 'OK', onPress: () => router.replace('/dashboard') }
      ]);
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
        ...(serviceCode ? { serviceCode } : {}),
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy ?? 0,
        }
      };

      const { data } = await apiClient.post('/api/evv/clock-in', payload);
      setVisit(data);
      Alert.alert('Success', 'Clocked in successfully!');
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
          accuracy: location.coords.accuracy ?? 0,
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
      {clientName ? <Text style={styles.clientName}>{clientName}</Text> : null}
      {scheduledTime ? <Text style={styles.scheduledTime}>{scheduledTime}</Text> : null}
      {isLoading ? (
        <ActivityIndicator size="large" color="#1a5fa8" />
      ) : (
        <View style={styles.buttonContainer}>
          {!visit ? (
            <Button title="Clock In" onPress={handleClockIn} disabled={!assignmentId} />
          ) : (
            <Button title="Clock Out" onPress={handleClockOut} color="#f97316"/>
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
  clientName: { fontSize: 20, fontWeight: '600', color: '#1a3a5c', marginBottom: 8 },
  scheduledTime: { fontSize: 16, color: '#5b8fc9', marginBottom: 24 },
  buttonContainer: { width: '80%' },
  statusText: { marginTop: 20, fontSize: 16, color: '#5b8fc9' },
});
