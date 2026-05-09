import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, Pressable } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

interface Assignment {
  id: string;
  clientName: string;
  time?: string; // Placeholder for now
  serviceCode?: string;
}

export default function DashboardScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const { data } = await apiClient.get('/api/assignments/caregiver');
        setAssignments(data || []);
      } catch (error) {
        console.error('Failed to fetch assignments', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const renderItem = ({ item }: { item: Assignment }) => (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => router.push({
        pathname: '/clockin',
        params: {
          assignmentId: item.id,
          clientName: item.clientName,
          scheduledTime: item.time ?? '',
          serviceCode: item.serviceCode ?? ''
        }
      })}
    >
      <Text style={styles.itemText}>{item.clientName}</Text>
      <Text>{item.time || 'Time not specified'}</Text>
      {item.serviceCode ? <Text style={styles.serviceCode}>{item.serviceCode}</Text> : null}
    </Pressable>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{"Today's Visits"}</Text>
        <Text style={{color: '#1a5fa8'}} onPress={() => { void logout().finally(() => router.replace('/login')); }}>Logout</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#1a5fa8" />
      ) : (
        <FlatList
          data={assignments}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20}}>No visits scheduled for today.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a3a5c' },
  item: { backgroundColor: 'white', padding: 20, marginVertical: 8, marginHorizontal: 16, borderRadius: 8, elevation: 1 },
  itemPressed: { opacity: 0.75 },
  itemText: { fontSize: 18, fontWeight: '500' },
  serviceCode: { marginTop: 8, color: '#1a5fa8', fontWeight: '600' },
});
