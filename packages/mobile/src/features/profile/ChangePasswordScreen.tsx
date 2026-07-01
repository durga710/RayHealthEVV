import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import ScreenHeader from '../common/ScreenHeader';
import { showAppAlert, showAppToast } from '../common/alerts/appAlert';

const MIN_PASSWORD = 12;

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD &&
    confirm === newPassword &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await apiClient.post('/api/profile/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      showAppToast({ message: "Password updated — you're all set.", variant: 'success' });
      router.back();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not change your password. Please try again.';
      showAppAlert('Password not changed', msg, undefined, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Password & security" />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
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
            {tooShort ? <Text style={styles.errHint}>{MIN_PASSWORD - newPassword.length} more character(s) needed</Text> : null}

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter new password"
              placeholderTextColor="#9db3c8"
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
            {mismatch ? <Text style={styles.errHint}>{"Passwords don't match"}</Text> : null}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [styles.primaryBtn, !canSubmit && styles.btnDisabled, pressed && canSubmit && { opacity: 0.9 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Update password</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    shadowColor: '#0f2d52', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  label: {
    fontSize: 11, fontWeight: '700', color: '#4a6480',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 6,
  },
  input: {
    height: 50, borderColor: '#dce8f2', borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, backgroundColor: '#f7fafd', fontSize: 16, color: '#1a3a5c', marginBottom: 6,
  },
  pwRow: {
    flexDirection: 'row', alignItems: 'center',
    borderColor: '#dce8f2', borderWidth: 1.5, borderRadius: 12,
    backgroundColor: '#f7fafd', paddingRight: 10, marginBottom: 6,
  },
  pwInput: { flex: 1, height: 50, paddingHorizontal: 14, fontSize: 16, color: '#1a3a5c' },
  eyeBtn: { padding: 4 },
  errHint: { color: '#b45309', fontSize: 12, marginBottom: 6 },

  primaryBtn: { height: 52, borderRadius: 14, backgroundColor: '#1a5fa8', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnDisabled: { backgroundColor: '#a8bdd4' },
});
