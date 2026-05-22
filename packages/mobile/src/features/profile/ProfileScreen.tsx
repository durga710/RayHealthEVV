import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';

interface QueueItem {
  id: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  clientName: string;
  timestamp: string;
  coords: string;
}

export default function ProfileScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  // High-fidelity offline visit-action queue simulation
  const [offlineQueue, setOfflineQueue] = useState<QueueItem[]>([
    {
      id: 'q-101',
      type: 'CLOCK_IN',
      clientName: 'Arthur Pendelton',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      coords: '40.4659° N, 79.8358° W'
    },
    {
      id: 'q-102',
      type: 'CLOCK_OUT',
      clientName: 'Arthur Pendelton',
      timestamp: new Date().toISOString(),
      coords: '40.4661° N, 79.8360° W'
    }
  ]);

  const handleSync = () => {
    if (offlineQueue.length === 0) {
      Alert.alert('Queue Empty', 'All Electronic Visit Verification records are securely synchronized with the Sandata State Registry.');
      return;
    }

    setSyncing(true);

    // Simulate sending transaction logs to the append-only database audit log
    setTimeout(() => {
      setOfflineQueue([]);
      setSyncing(false);
      Alert.alert(
        'Synchronization Successful 🚀',
        'Successfully dispatched 2 pending EVV records. The append-only audit event log has been updated and cryptographically sealed.',
        [{ text: 'Great' }]
      );
    }, 1500);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1248a0" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Caregiver Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={36} color="#ffffff" />
            </View>
            <View style={styles.activeIndicator} />
          </View>
          
          <Text style={styles.caregiverName}>PA Certified Caregiver</Text>
          <Text style={styles.caregiverRole}>Active In-Home Support Specialist</Text>
          
          <View style={styles.badgeRow}>
            <View style={styles.credentialBadge}>
              <Ionicons name="card" size={12} color="#1a5fa8" />
              <Text style={styles.credentialText}>ID: RH-884920</Text>
            </View>
            <View style={styles.credentialBadge}>
              <Ionicons name="ribbon" size={12} color="#22c55e" />
              <Text style={[styles.credentialText, { color: '#166534' }]}>TB SCREEN: OK</Text>
            </View>
          </View>
        </View>

        {/* Offline Action Queue Inspector */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cloud-offline" size={20} color="#f97316" />
            <Text style={styles.sectionTitle}>Offline Visit-Action Queue</Text>
            {offlineQueue.length > 0 && (
              <View style={styles.queueCounter}>
                <Text style={styles.queueCounterText}>{offlineQueue.length} PENDING</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.sectionLead}>
            If you lose connection inside rural client locations, RayHealth secure buffers preserve EVV transaction keys locally.
          </Text>

          {offlineQueue.length === 0 ? (
            <View style={styles.emptyQueue}>
              <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
              <Text style={styles.emptyQueueText}>All records synced to registry</Text>
            </View>
          ) : (
            <View style={styles.queueList}>
              {offlineQueue.map((item) => (
                <View key={item.id} style={styles.queueItem}>
                  <View style={styles.queueIconBox}>
                    <Ionicons 
                      name={item.type === 'CLOCK_IN' ? 'log-in' : 'log-out'} 
                      size={18} 
                      color={item.type === 'CLOCK_IN' ? '#1a5fa8' : '#f97316'} 
                    />
                  </View>
                  <View style={styles.queueItemBody}>
                    <View style={styles.queueHeaderRow}>
                      <Text style={styles.queueType}>{item.type}</Text>
                      <Text style={styles.queueTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.queueClient}>{item.clientName}</Text>
                    <Text style={styles.queueCoords}>{item.coords}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {syncing ? (
            <View style={styles.syncingContainer}>
              <ActivityIndicator size="small" color="#1a5fa8" />
              <Text style={styles.syncingText}>Transmitting transaction keys...</Text>
            </View>
          ) : (
            <Pressable 
              style={[styles.syncButton, offlineQueue.length === 0 && styles.syncButtonDisabled]} 
              onPress={handleSync}
            >
              <Ionicons name="refresh-circle" size={20} color="#ffffff" />
              <Text style={styles.syncButtonText}>SYNC OFFLINE TRANSACTIONS</Text>
            </Pressable>
          )}
        </View>

        {/* Telephony Fallback HUD */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="call" size={20} color="#1a5fa8" />
            <Text style={styles.sectionTitle}>PA DHS Telephony EVV Fallback</Text>
          </View>
          
          <Text style={styles.sectionLead}>
            {"If cellular internet and mobile devices fail completely, Pennsylvania DHS allows logging visits using the client's landline."}
          </Text>

          <View style={styles.fallbackAlertCard}>
            <Text style={styles.fallbackAlertTitle}>TELEPHONY TOLL-FREE CALL LINE</Text>
            <Text style={styles.fallbackAlertPhone}>1-800-555-EVV-PA (388-72)</Text>
            
            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepText}>{"Call the toll-free number from the client's home phone line."}</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepText}>{"Enter your Caregiver ID (RH-884920) followed by the pound key."}</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
              <Text style={styles.stepText}>{"Select \"1\" to Clock In or \"2\" to Clock Out and input PA Duty Codes."}</Text>
            </View>
          </View>
        </View>

        {/* System Settings & Actions */}
        <View style={styles.actionCard}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#ef4444" />
            <Text style={styles.logoutButtonText}>SECURE LOGOUT</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8'
  },
  scrollContent: {
    padding: 16,
    gap: 16
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef2f6'
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1248a0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  caregiverName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1a3a5c',
    marginBottom: 4
  },
  caregiverRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8
  },
  credentialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4
  },
  credentialText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1a5fa8'
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef2f6'
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1a3a5c',
    flex: 1
  },
  queueCounter: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  queueCounterText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#9a3412',
    letterSpacing: 0.5
  },
  sectionLead: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14
  },
  emptyQueue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 14
  },
  emptyQueueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534'
  },
  queueList: {
    gap: 8,
    marginBottom: 14
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 10
  },
  queueIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  queueItemBody: {
    flex: 1
  },
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  queueType: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1a3a5c'
  },
  queueTime: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8'
  },
  queueClient: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a3a5c',
    marginTop: 2
  },
  queueCoords: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#64748b',
    marginTop: 1
  },
  syncButton: {
    backgroundColor: '#f97316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2
  },
  syncButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12
  },
  syncingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a5fa8'
  },
  fallbackAlertCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14
  },
  fallbackAlertTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  fallbackAlertPhone: {
    fontSize: 20,
    fontWeight: '950',
    color: '#1a5fa8',
    marginBottom: 14
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(26, 95, 168, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1
  },
  stepNumText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1a5fa8'
  },
  stepText: {
    flex: 1,
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    fontWeight: '600'
  },
  actionCard: {
    marginBottom: 20
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fee2e2',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5
  }
});
