import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, Pressable } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

/**
 * Shape returned by GET /api/evv/today-schedule.
 * scheduledTime is null until the assignments.scheduled_date migration lands.
 */
interface ScheduleItem {
  id: string;
  caregiverId: string;
  visitTemplateId: string;
  clientName: string;
  scheduledTime: string | null;
  clockedInToday: boolean;
}

export default function DashboardScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const { data } = await apiClient.get<ScheduleItem[]>('/api/evv/today-schedule');
        setSchedule(data || []);
      } catch (error) {
        console.error('Failed to fetch today schedule', error);
      } finally {
        setLoading(false);
      }
    };
    void fetchSchedule();
  }, []);

  const openClockIn = (item: ScheduleItem) => {
    router.push({
      pathname: '/clockin',
      params: {
        assignmentId: item.id,
        clientName: item.clientName,
        scheduledTime: item.scheduledTime ?? '',
      },
    });
  };

  const renderItem = ({ item }: { item: ScheduleItem }) => (
    <Pressable style={styles.item} onPress={() => openClockIn(item)}>
      <View>
        <Text style={styles.itemText}>{item.clientName}</Text>
        <Text style={styles.itemMeta}>
          {item.scheduledTime || 'Time not specified'}
        </Text>
      </View>
      <View style={styles.itemRight}>
        {item.clockedInToday ? (
          <Text style={styles.clockedInBadge}>✓ Clocked In</Text>
        ) : (
          <Text style={styles.itemAction}>Start EVV</Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{"Today's Visits"}</Text>
        <Text
          style={{ color: '#1a5fa8' }}
          onPress={() => { void logout().finally(() => router.replace('/login')); }}
        >
          Logout
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#1a5fa8" />
      ) : (
        <FlatList
          data={schedule}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20 }}>
              No visits scheduled for today.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
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
    padding: 20,
  },
  itemText: { fontSize: 18, fontWeight: '500' },
  itemMeta: { color: '#64748b', marginTop: 4 },
  itemRight: { alignItems: 'flex-end' },
  itemAction: { color: '#1a5fa8', fontWeight: '700' },
  clockedInBadge: { color: '#059669', fontWeight: '700' },
});
