import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import apiClient from '../../lib/api-client';

interface Profile {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatarUrl: string | null;
}

const MIN_PASSWORD = 12;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Editable detail fields (seeded from the fetched profile).
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  // Change-password fields.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await apiClient.get<Profile>('/api/profile');
        if (!active) return;
        setProfile(data);
        setFirstName(data.firstName ?? '');
        setLastName(data.lastName ?? '');
        setPhone(data.phone ?? '');
      } catch {
        // Leave profile null; the screen shows a retry-free empty state and the
        // global 401 handler covers an expired session.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const initials = `${firstName} ${lastName}`.trim()
    ? `${firstName} ${lastName}`.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : (profile?.email?.[0] ?? '?').toUpperCase();

  const detailsDirty =
    profile != null &&
    (firstName !== (profile.firstName ?? '') ||
      lastName !== (profile.lastName ?? '') ||
      phone !== (profile.phone ?? ''));

  const handleSaveDetails = async () => {
    if (!detailsDirty || savingDetails) return;
    setSavingDetails(true);
    try {
      await apiClient.patch('/api/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      setProfile((p) =>
        p ? { ...p, firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() } : p,
      );
      Alert.alert('Saved', 'Your details have been updated.');
    } catch {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    } finally {
      setSavingDetails(false);
    }
  };

  const canChangePw =
    currentPassword.length > 0 && newPassword.length >= MIN_PASSWORD && !changingPw;

  const handleChangePassword = async () => {
    if (!canChangePw) return;
    setChangingPw(true);
    try {
      await apiClient.post('/api/profile/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Password changed', 'Your password has been updated.');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not change your password. Please try again.';
      Alert.alert('Password not changed', msg);
    } finally {
      setChangingPw(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#0f2d52', '#1a5fa8']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1}>
          {`${firstName} ${lastName}`.trim() || 'Your profile'}
        </Text>
        {profile?.email ? (
          <Text style={styles.headerEmail} numberOfLines={1}>{profile.email}</Text>
        ) : null}
        {profile?.role ? (
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{profile.role.toUpperCase()}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#1a5fa8" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Details */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>My details</Text>

              <Text style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#9db3c8"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Last name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#9db3c8"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 555-5555"
                placeholderTextColor="#9db3c8"
                keyboardType="phone-pad"
              />

              <Pressable
                onPress={handleSaveDetails}
                disabled={!detailsDirty || savingDetails}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!detailsDirty || savingDetails) && styles.btnDisabled,
                  pressed && detailsDirty && { opacity: 0.9 },
                ]}
              >
                {savingDetails ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>{detailsDirty ? 'Save changes' : 'Saved'}</Text>
                )}
              </Pressable>
            </View>

            {/* My Training */}
            <Pressable
              onPress={() => router.push('/training')}
              style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.92 }]}
            >
              <View style={styles.navIcon}>
                <Ionicons name="school-outline" size={20} color="#1a5fa8" />
              </View>
              <View style={styles.navTextWrap}>
                <Text style={styles.navTitle}>My Training</Text>
                <Text style={styles.navSub}>Courses & certificates</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9db3c8" />
            </Pressable>

            {/* Change password */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Change password</Text>

              <Text style={styles.label}>Current password</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor="#9db3c8"
                secureTextEntry={!showPw}
                autoCapitalize="none"
              />

              <Text style={styles.label}>New password</Text>
              <View style={styles.pwRow}>
                <TextInput
                  style={styles.pwInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  placeholderTextColor="#9db3c8"
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6898c0" />
                </Pressable>
              </View>
              {newPassword.length > 0 && newPassword.length < MIN_PASSWORD ? (
                <Text style={styles.hint}>{MIN_PASSWORD - newPassword.length} more character(s) needed</Text>
              ) : null}

              <Pressable
                onPress={handleChangePassword}
                disabled={!canChangePw}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  !canChangePw && styles.btnDisabled,
                  pressed && canChangePw && { opacity: 0.9 },
                ]}
              >
                {changingPw ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Update password</Text>
                )}
              </Pressable>
            </View>

            {/* Log out */}
            <Pressable
              onPress={confirmLogout}
              style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="log-out-outline" size={18} color="#b91c1c" />
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  flex: { flex: 1 },

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

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    shadowColor: '#0f2d52', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#0f2d52', marginBottom: 14 },
  label: {
    fontSize: 11, fontWeight: '700', color: '#4a6480',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 4,
  },
  input: {
    height: 50, borderColor: '#dce8f2', borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, backgroundColor: '#f7fafd', fontSize: 16, color: '#1a3a5c',
    marginBottom: 8,
  },
  pwRow: {
    flexDirection: 'row', alignItems: 'center',
    borderColor: '#dce8f2', borderWidth: 1.5, borderRadius: 12,
    backgroundColor: '#f7fafd', paddingRight: 10, marginBottom: 8,
  },
  pwInput: { flex: 1, height: 50, paddingHorizontal: 14, fontSize: 16, color: '#1a3a5c' },
  eyeBtn: { padding: 4 },
  hint: { color: '#b45309', fontSize: 12, marginBottom: 6 },

  primaryBtn: {
    height: 50, borderRadius: 12, backgroundColor: '#1a5fa8',
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnDisabled: { backgroundColor: '#a8bdd4' },

  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    shadowColor: '#0f2d52', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  navIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#eaf2fb',
    justifyContent: 'center', alignItems: 'center',
  },
  navTextWrap: { flex: 1 },
  navTitle: { fontSize: 15, fontWeight: '800', color: '#0f2d52' },
  navSub: { fontSize: 12, color: '#5a7088', marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    height: 50, borderRadius: 12, backgroundColor: '#fff5f5',
    borderWidth: 1, borderColor: '#fecaca',
  },
  logoutText: { color: '#b91c1c', fontSize: 15, fontWeight: '800' },
});
