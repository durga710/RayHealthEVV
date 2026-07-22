import React, { useCallback, useState } from 'react';
import {
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
import { confirmEmail, confirmWebLink, openInAppBrowser } from '../common/external-link';
import { Skeleton } from '../common/Skeleton';
import { colors, typography, radii, shadow, gradients, alpha } from '../common/tokens';

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
      <View style={[styles.rowIcon, { backgroundColor: `${tint}${alpha.tint}` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.chevron} /> : null}
      {!isLast ? <View style={styles.rowDivider} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, user, agencies } = useAuth();
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
    confirmEmail({
      title: 'Contact Support',
      message: 'Our support team is ready to help. Reach us by email and we will get back to you.',
      email: 'support@rayhealthevv.com',
      subject: 'RayHealthEVV Support',
      icon: 'help-buoy-outline',
    });
  };

  const openPrivacyPolicy = () => {
    confirmWebLink({
      title: 'Privacy policy',
      message: 'Our privacy policy is available on the RayHealthEVV website. It explains how we protect and handle your data.',
      url: 'https://rayhealthevv.com/privacy',
      icon: 'shield-checkmark-outline',
    });
  };

  const showAbout = () => {
    showAppAlert(
      'RayHealthEVV',
      `Version ${version}. Electronic Visit Verification for home care, built for Pennsylvania agencies and caregivers. Learn more on our website.`,
      [{ text: 'Close', style: 'cancel' }],
      {
        variant: 'info',
        icon: 'information-circle-outline',
        link: { label: 'rayhealthevv.com', onPress: () => void openInAppBrowser('https://rayhealthevv.com') },
      },
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient colors={gradients.header} style={[styles.header, { paddingTop: insets.top + 18 }]}>
        {profile ? (
          <>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.headerName} numberOfLines={1}>{fullName || 'Your profile'}</Text>
            {profile.email ? <Text style={styles.headerEmail} numberOfLines={1}>{profile.email}</Text> : null}
            {profile.role ? (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{profile.role.toUpperCase()}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Skeleton width={76} height={76} radius={38} color="#ffffff33" style={styles.avatarSkeleton} />
            <Skeleton width={120} height={16} radius={8} color="#ffffff2e" />
            <Skeleton width={160} height={12} radius={6} color="#ffffff2e" style={styles.lineSkeleton} />
          </>
        )}
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.group}>
          <Row
            icon="person-outline"
            tint={colors.brandBlue}
            title="Personal details"
            subtitle="Name and phone number"
            onPress={() => router.push('/profile-details')}
          />
          <Row
            icon="business-outline"
            tint={colors.teal}
            title="Linked agencies"
            subtitle={
              user?.agencyName
                ? `Working in ${user.agencyName}`
                : agencies.length > 1
                  ? `${agencies.length} agencies linked`
                  : 'View and switch agencies'
            }
            onPress={() => router.push('/select-agency?intent=switch')}
          />
          <Row
            icon="lock-closed-outline"
            tint={colors.purple}
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
            tint={colors.success}
            title="My Training"
            subtitle="Courses & certificates"
            onPress={() => router.push('/training')}
            isLast
          />
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.group}>
          <Row
            icon="book-outline"
            tint={colors.cyan}
            title="Help & User Guide"
            subtitle="How to use RayHealthEVV"
            onPress={() => router.push('/help')}
          />
          <Row
            icon="help-buoy-outline"
            tint={colors.amber}
            title="Contact Support"
            subtitle="Email RayHealthEVV support"
            onPress={openSupport}
          />
          <Row
            icon="shield-checkmark-outline"
            tint={colors.success}
            title="Privacy policy"
            subtitle="How RayHealthEVV handles your data"
            onPress={openPrivacyPolicy}
          />
          <Row
            icon="information-circle-outline"
            tint={colors.slate}
            title="About"
            value={`v${version}`}
            onPress={showAbout}
            isLast
          />
        </View>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <Text style={styles.footer}>RayHealthEVV™ · HIPAA-secured</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },

  header: { alignItems: 'center', paddingBottom: 24, paddingHorizontal: 24 },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#ffffff22', borderWidth: 2, borderColor: '#ffffff45',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  headerName: { ...typography.title, color: '#fff' },
  headerEmail: { ...typography.sub, color: colors.onGradientSoft, marginTop: 3 },
  rolePill: {
    marginTop: 10, backgroundColor: '#ffffff1f', borderRadius: radii.pill,
    paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#ffffff2b',
  },
  rolePillText: { color: '#bfdbfe', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  avatarSkeleton: { marginBottom: 12 },
  lineSkeleton: { marginTop: 8 },

  scroll: { padding: 16, paddingBottom: 36 },
  sectionLabel: {
    ...typography.label, color: colors.textSecondary,
    marginLeft: 4, marginBottom: 8, marginTop: 12,
  },
  group: {
    backgroundColor: colors.cardBg, borderRadius: radii.lg, overflow: 'hidden',
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, paddingVertical: 14 },
  rowPressed: { backgroundColor: colors.pressedBg },
  rowIcon: { width: 36, height: 36, borderRadius: radii.sm, justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowValue: { fontSize: 14, color: colors.textMuted, fontWeight: '600', marginRight: 2 },
  rowDivider: {
    position: 'absolute', left: 63, right: 0, bottom: 0, height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },

  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    height: 52, borderRadius: radii.md, backgroundColor: colors.dangerBg,
    borderWidth: 1, borderColor: colors.dangerBorder, marginTop: 24,
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '800' },

  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 18 },
});
