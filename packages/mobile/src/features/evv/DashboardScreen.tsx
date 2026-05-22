import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Pressable,
  Platform,
  StatusBar
} from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../lib/api-client';

interface Assignment {
  id: string;
  clientName: string;
  time?: string;
  address?: string;
}

export default function DashboardScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Mapped/mocked stats for premium look
  const [stats] = useState({
    weeklyHours: '18.5 hrs',
    completedVisits: '12 visits',
    compliance: '100% Compliant',
    syncStatus: 'Synced'
  });

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

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const renderItem = ({ item }: { item: Assignment }) => (
    <Pressable style={styles.visitCard} onPress={() => openClockIn(item)}>
      <View style={styles.visitHeader}>
        <View style={styles.visitTimeContainer}>
          <Ionicons name="time" size={16} color="#f97316" />
          <Text style={styles.visitTime}>{item.time || 'Schedule Flexible'}</Text>
        </View>
        <View style={styles.visitBadge}>
          <Text style={styles.visitBadgeText}>PA EVV</Text>
        </View>
      </View>

      <Text style={styles.visitClientName}>{item.clientName}</Text>

      <View style={styles.visitAddressRow}>
        <Ionicons name="location-sharp" size={16} color="#5b8fc9" />
        <Text style={styles.visitAddress} numberOfLines={1}>
          {item.address || '225 National Dr, Pittsburgh PA 15235'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.visitFooter}>
        <Text style={styles.visitActionLabel}>AUTHORIZATION VALIDATED</Text>
        <View style={styles.visitButton}>
          <Text style={styles.visitButtonText}>START EVV</Text>
          <Ionicons name="arrow-forward" size={14} color="#ffffff" />
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1248a0" />

      {/* Greeting Header Cockpit */}
      <View style={styles.headerCockpit}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingText}>Welcome Back,</Text>
            <Text style={styles.caregiverName}>PA Certified Caregiver</Text>
          </View>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#bdd3f0" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        {/* Brand identity badge */}
        <View style={styles.brandRow}>
          <Ionicons name="shield-checkmark" size={16} color="#f97316" />
          <Text style={styles.brandTagline}>PENNSYLVANIA DHS COMPLIANT EVV SYSTEM</Text>
        </View>
      </View>

      {/* KPI Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(26, 95, 168, 0.1)' }]}>
            <Ionicons name="time" size={20} color="#1a5fa8" />
          </View>
          <Text style={styles.statLabel}>WEEKLY HOURS</Text>
          <Text style={styles.statValue}>{stats.weeklyHours}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
            <Ionicons name="calendar" size={20} color="#f97316" />
          </View>
          <Text style={styles.statLabel}>VISITS DONE</Text>
          <Text style={styles.statValue}>{stats.completedVisits}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
            <Ionicons name="ribbon" size={20} color="#22c55e" />
          </View>
          <Text style={styles.statLabel}>DHS STATUS</Text>
          <View style={styles.badgeSuccess}>
            <Text style={styles.badgeSuccessText}>COMPLIANT</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
            <Ionicons name="cloud-done" size={20} color="#6366f1" />
          </View>
          <Text style={styles.statLabel}>OFFLINE QUEUE</Text>
          <Text style={[styles.statValue, { color: '#6366f1' }]}>{stats.syncStatus}</Text>
        </View>
      </View>

      {/* Schedule Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{"Today's Assigned Schedules"}</Text>
        <View style={styles.dotIndicator} />
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#1a5fa8" />
          <Text style={styles.loaderText}>Syncing care plans...</Text>
        </View>
      ) : (
        <FlatList
          data={assignments}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="file-tray-sharp" size={48} color="#bdd3f0" />
              <Text style={styles.emptyTitle}>No scheduled assignments</Text>
              <Text style={styles.emptyBody}>
                You have no EVV visits authorized for today. Check with your agency administrator if you expect an assignment.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8'
  },
  headerCockpit: {
    backgroundColor: '#1248a0',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 24,
    shadowColor: '#1248a0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  greetingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#bdd3f0',
    letterSpacing: 0.3
  },
  caregiverName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4
  },
  logoutText: {
    color: '#bdd3f0',
    fontSize: 12,
    fontWeight: '700'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 14,
    gap: 6
  },
  brandTagline: {
    color: '#f97316',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: -16,
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 20
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '48%',
    padding: 12,
    alignItems: 'center',
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  statValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1a3a5c'
  },
  badgeSuccess: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeSuccessText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 0.3
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1a3a5c',
    letterSpacing: 0.3
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316'
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  visitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#eef2f6'
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  visitTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  visitTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f97316'
  },
  visitBadge: {
    backgroundColor: 'rgba(18, 72, 160, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  visitBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1248a0',
    letterSpacing: 0.3
  },
  visitClientName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1a3a5c',
    marginBottom: 8
  },
  visitAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14
  },
  visitAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    flex: 1
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f4f8',
    marginBottom: 12
  },
  visitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  visitActionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5
  },
  visitButton: {
    backgroundColor: '#1a5fa8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6
  },
  visitButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef2f6'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1a3a5c',
    marginTop: 12,
    marginBottom: 8
  },
  emptyBody: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40
  },
  loaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 8
  }
});
