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

function formatRole(role: string | undefined): string {
  if (!role) return '';
  // 'caregiver' -> 'Caregiver', 'admin' -> 'Admin'
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function greetingFor(user: { role?: string; firstName?: string } | null): string {
  if (user?.firstName) return `Welcome back, ${user.firstName}.`;
  if (user?.role) return `Welcome back, ${formatRole(user.role)}.`;
  return 'Welcome back.';
}

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const { data } = await apiClient.get('/api/assignments/caregiver');
        setAssignments(data || []);
      } catch (error) {
        // 401 is handled centrally by the api-client interceptor (clears state, shows toast).
        // For other errors, surface to the operator log without spamming console.error.
        if ((error as { response?: { status?: number } })?.response?.status !== 401) {
          console.log('Failed to fetch assignments', error);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchAssignments();
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
      <View style={styles.headerBlock}>
        {/* SECURE SESSION pill — mirrors the web client's COOKIE SESSION ACTIVE indicator. */}
        <View style={styles.sessionPill} accessibilityRole="text" accessibilityLabel="Secure session active">
          <View style={styles.sessionDot} />
          <Text style={styles.sessionPillText}>Secure Session</Text>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.greeting}>{greetingFor(user)}</Text>
          <Pressable
            onPress={() => { void logout().finally(() => router.replace('/login')); }}
            hitSlop={12}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{"Today's Visits"}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a5fa8" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={assignments}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No visits scheduled for today.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const SESSION_GREEN = '#16a34a';
// 12% tint of #16a34a — using hex alpha (1F ~= 12%).
const SESSION_GREEN_TINT = '#16a34a1F';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  headerBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  sessionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SESSION_GREEN_TINT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SESSION_GREEN,
    marginRight: 6
  },
  sessionPillText: {
    color: SESSION_GREEN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  greeting: { fontSize: 20, fontWeight: '600', color: '#1a3a5c', flexShrink: 1, paddingRight: 12 },
  logoutButton: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'flex-end' },
  logoutButtonPressed: { opacity: 0.6 },
  logoutText: { color: '#1a5fa8', fontWeight: '600' },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a3a5c', marginTop: 16 },
  item: { backgroundColor: 'white', padding: 20, marginVertical: 8, marginHorizontal: 16, borderRadius: 8, elevation: 1 },
  itemPressed: { opacity: 0.75 },
  itemText: { fontSize: 18, fontWeight: '500' },
  serviceCode: { marginTop: 8, color: '#1a5fa8', fontWeight: '600' }
});
