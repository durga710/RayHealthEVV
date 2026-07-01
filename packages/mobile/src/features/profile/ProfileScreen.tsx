import React, { useCallback, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import apiClient from '../../lib/api-client';
import { showAppAlert } from '../common/alerts/appAlert';

interface Profile {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

type IconName = keyof typeof Ionicons.glyphMap;

function Row({
  icon,
  tint,
  title,
  subtitle,
  value,
  onPress,
  isLast,
}: {
  icon: IconName;
  tint: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${tint}1a` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color="#bcccdc" /> : null}
      {!isLast ? <View style={styles.rowDivider} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data } = await apiClient.get<Profile>('/api/profile');
          if (active) setProfile(data);
        } catch {
          // Header falls back to placeholders; sub-screens handle their own loads.
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  const initials = fullName
    ? fullName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : (profile?.email?.[0] ?? '?').toUpperCase();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const confirmLogout = () => {
    showAppAlert(
      'Log out?',
      "You'll need to sign in again to clock in or view your schedule.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => void logout() },
      ],
      { variant: 'destructive', icon: 'log-out-outline' },
    );
  };

  const openSupport = () => {
    Linking.openURL('mailto:support@rayhealthevv.com?subject=RayHealthEVV%20Support').catch(() => {
      showAppAlert('Support', 'Email us at support@rayhealthevv.com', undefined, { variant: 'info', icon: 'help-buoy-outline' });
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1}>{fullName || 'Your profile'}</Text>
        {profile?.email ? <Text style={styles.headerEmail} numberOfLines={1}>{profile.email}</Text> : null}
        {profile?.role ? (
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{profile.role.toUpperCase()}</Text>
          </View>
        ) : null}
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.group}>
          <Row
            icon="person-outline"
            tint="#1a5fa8"
            title="Personal details"
            subtitle="Name and phone number"
            onPress={() => router.push('/profile-details')}
          />
          <Row
            icon="lock-closed-outline"
            tint="#7c3aed"
            title="Password & security"
            subtitle="Change your password"
            onPress={() => router.push('/change-password')}
            isLast
          />
        </View>

        <Text style={styles.sectionLabel}>Workforce</Text>
        <View style={styles.group}>
          <Row
            icon="school-outline"
            tint="#16a34a"
            title="My Training"
            subtitle="Courses & certificates"
            onPress={() => router.push('/training')}
            isLast
          />
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.group}>
          <Row
            icon="help-buoy-outline"
            tint="#0891b2"
            title="Help & Support"
            subtitle="Contact your agency"
            onPress={openSupport}
          />
          <Row
            icon="information-circle-outline"
            tint="#64748b"
            title="About"
            value={`v${version}`}
            isLast
          />
        </View>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="log-out-outline" size={18} color="#b91c1c" />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <Text style={styles.footer}>RayHealthEVV™ · HIPAA-secured</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },

  header: { alignItems: 'center', paddingBottom: 24, paddingHorizontal: 24 },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#ffffff22', borderWidth: 2, borderColor: '#ffffff45',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  headerName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  headerEmail: { fontSize: 13, color: '#cfe2f5', marginTop: 3 },
  rolePill: {
    marginTop: 10, backgroundColor: '#ffffff1f', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#ffffff2b',
  },
  rolePillText: { color: '#bfdbfe', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },

  scroll: { padding: 16, paddingBottom: 36 },
  sectionLabel: {
    fontSize: 12, fontWeight: '900', color: '#4a6480',
    textTransform: 'uppercase', letterSpacing: 0.7, marginLeft: 4, marginBottom: 8, marginTop: 12,
  },
  group: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#0f2d52', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 14 },
  rowPressed: { backgroundColor: '#f5f9fd' },
  rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#0f2d52' },
  rowSub: { fontSize: 12, color: '#5a7088', marginTop: 2 },
  rowValue: { fontSize: 14, color: '#8499ad', fontWeight: '600', marginRight: 2 },
  rowDivider: {
    position: 'absolute', left: 63, right: 0, bottom: 0, height: StyleSheet.hairlineWidth,
    backgroundColor: '#e6edf4',
  },

  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    height: 52, borderRadius: 14, backgroundColor: '#fff5f5',
    borderWidth: 1, borderColor: '#fecaca', marginTop: 24,
  },
  logoutText: { color: '#b91c1c', fontSize: 15, fontWeight: '800' },

  footer: { textAlign: 'center', color: '#9db3c8', fontSize: 12, marginTop: 18 },
});
