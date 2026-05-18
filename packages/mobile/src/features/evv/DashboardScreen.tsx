import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, Pressable } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

interface Assignment {
  id: string;
  clientName: string;
  time?: string;
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

  const openClockIn = (assignment: Assignment) => {
    router.push({
      pathname: '/clockin',
      params: {
        assignmentId: assignment.id,
        clientName: assignment.clientName,
        scheduledTime: assignment.time ?? ''
      }
    });
  };

  const renderItem = ({ item }: { item: Assignment }) => (
    <Pressable style={styles.item} onPress={() => openClockIn(item)}>
      <View>
        <Text style={styles.itemText}>{item.clientName}</Text>
        <Text style={styles.itemMeta}>{item.time || 'Time not specified'}</Text>
      </View>
      <Text style={styles.itemAction}>Start EVV</Text>
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
  item: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 20
  },
  itemText: { fontSize: 18, fontWeight: '500' },
  itemMeta: { color: '#64748b', marginTop: 4 },
  itemAction: { color: '#1a5fa8', fontWeight: '700' },
});
