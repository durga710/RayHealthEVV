import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  ActivityIndicator, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  read: boolean;
}

/**
 * NotificationScreen
 *
 * Displays in-app notifications for the caregiver. Currently a scaffold —
 * no notification endpoint exists yet. Renders a friendly empty state until
 * GET /api/notifications is implemented.
 *
 * TODO: Wire GET /api/notifications (requires new app route + core migration).
 * TODO: Mark-as-read on tap (PATCH /api/notifications/:id/read).
 */
export default function NotificationScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Endpoint not yet implemented — graceful empty state on 404/500
        const { data } = await apiClient.get<Notification[]>('/api/notifications');
        setNotifications(data || []);
      } catch {
        // Not an error — endpoint not deployed yet
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchNotifications();
  }, []);

  const renderItem = ({ item }: { item: Notification }) => (
    <View style={[styles.item, item.read && styles.itemRead]}>
      <Text style={styles.itemType}>{item.type}</Text>
      <Text style={styles.itemMessage}>{item.message}</Text>
      <Text style={styles.itemDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a5fa8" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyBody}>
                You will see reminders and updates from your agency here once the notification service is enabled.
              </Text>
            </View>
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
  back: { color: '#1a5fa8', fontWeight: '600' },
  item: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    elevation: 1,
  },
  itemRead: { opacity: 0.6 },
  itemType: {
    fontSize: 11,
    color: '#1a5fa8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemMessage: { fontSize: 15, color: '#1a3a5c', marginTop: 4 },
  itemDate: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  emptyState: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1a3a5c', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
