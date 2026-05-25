import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';

type ProfileOption = {
  label: string;
  sublabel: string;
  onPress: () => void;
  destructive?: boolean;
};

/**
 * ProfileScreen
 *
 * Displays caregiver profile info and sub-options. Currently a scaffold —
 * no profile endpoint is wired. The screen is reachable from the Dashboard
 * tab header (once a Profile tab is added to TabLayout).
 *
 * Sub-options planned:
 * - Change Password → /profile/change-password (not built yet)
 * - Notification Settings → /notifications
 * - Help / Support → /support-chat (AI support chat exists at /api/support/chat)
 * - Sign Out
 *
 * TODO: Wire GET /api/auth/mobile/me to populate name/email/role.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const options: ProfileOption[] = [
    {
      label: 'Notifications',
      sublabel: 'View alerts and reminders',
      onPress: () => router.push('/notifications'),
    },
    {
      label: 'Help & Support',
      sublabel: 'Chat with the RayHealth assistant',
      onPress: () => router.push('/support'),
    },
    {
      label: 'Sign Out',
      sublabel: 'Log out of the app',
      onPress: handleLogout,
      destructive: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>

        {/* Avatar placeholder */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>C</Text>
          </View>
          <Text style={styles.name}>Caregiver</Text>
          <Text style={styles.role}>Field Staff</Text>
        </View>

        <View style={styles.section}>
          {options.map((opt, i) => (
            <Pressable
              key={i}
              style={[styles.option, opt.destructive && styles.optionDestructive]}
              onPress={opt.onPress}
            >
              <View>
                <Text style={[styles.optionLabel, opt.destructive && styles.optionLabelDestructive]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionSublabel}>{opt.sublabel}</Text>
              </View>
              {!opt.destructive && <Text style={styles.chevron}>›</Text>}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a3a5c', marginBottom: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a5fa8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: '700', color: '#1a3a5c' },
  role: { fontSize: 14, color: '#64748b', marginTop: 2 },
  section: { gap: 2 },
  option: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  optionDestructive: { backgroundColor: '#fff5f5' },
  optionLabel: { fontSize: 16, fontWeight: '600', color: '#1a3a5c' },
  optionLabelDestructive: { color: '#dc2626' },
  optionSublabel: { fontSize: 13, color: '#64748b', marginTop: 2 },
  chevron: { fontSize: 22, color: '#94a3b8' },
});
