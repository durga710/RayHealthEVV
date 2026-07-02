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
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import ScreenHeader from '../common/ScreenHeader';
import { showAppAlert, showAppToast } from '../common/alerts/appAlert';
import { colors, typography, radii, shadow } from '../common/tokens';

const MIN_PASSWORD = 12;

// ── Password strength ─────────────────────────────────────────────────────────
// Derived from the password value during render — no focus/blur state.

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
const STRENGTH_COLORS = [
  colors.border,
  colors.danger,
  colors.amber,
  colors.brandBlue,
  colors.success,
] as const;

function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= MIN_PASSWORD) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
}

function StrengthSegment({ filled, color }: { filled: boolean; color: string }) {
  const fillStyle = useAnimatedStyle(() => ({
    opacity: withTiming(filled ? 1 : 0, { duration: 200 }),
  }));
  return (
    <View style={styles.strengthSegment}>
      <Animated.View style={[styles.strengthSegmentFill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

function StrengthMeter({ password }: { password: string }) {
  const score = passwordScore(password);
  const activeColor = STRENGTH_COLORS[score];
  return (
    <View style={styles.strengthRow}>
      <View style={styles.strengthSegments}>
        {[1, 2, 3, 4].map((step) => (
          <StrengthSegment key={step} filled={score >= step} color={activeColor} />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: score > 0 ? activeColor : colors.textMuted }]}>
        {STRENGTH_LABELS[score]}
      </Text>
    </View>
  );
}

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
              placeholderTextColor={colors.placeholder}
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
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPw}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.onGradientFaint} />
              </Pressable>
            </View>
            {newPassword.length > 0 ? <StrengthMeter password={newPassword} /> : null}
            {tooShort ? <Text style={styles.errHint}>{MIN_PASSWORD - newPassword.length} more character(s) needed</Text> : null}

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.placeholder}
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
  container: { flex: 1, backgroundColor: colors.screenBg },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.cardBg, borderRadius: radii.lg, padding: 18,
    ...shadow.card,
  },
  label: {
    ...typography.label, color: colors.textSecondary,
    marginBottom: 6, marginTop: 6,
  },
  input: {
    height: 50, borderColor: colors.inputBorder, borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, backgroundColor: colors.inputBg, fontSize: 16, color: colors.inputText, marginBottom: 6,
  },
  pwRow: {
    flexDirection: 'row', alignItems: 'center',
    borderColor: colors.inputBorder, borderWidth: 1.5, borderRadius: 12,
    backgroundColor: colors.inputBg, paddingRight: 10, marginBottom: 6,
  },
  pwInput: { flex: 1, height: 50, paddingHorizontal: 14, fontSize: 16, color: colors.inputText },
  eyeBtn: { padding: 4 },
  errHint: { color: colors.danger, fontSize: 12, marginBottom: 6 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: 2 },
  strengthSegments: { flex: 1, flexDirection: 'row', gap: 5 },
  strengthSegment: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden',
  },
  strengthSegmentFill: { flex: 1, borderRadius: 2 },
  strengthLabel: { ...typography.caption, minWidth: 42, textAlign: 'right' },

  primaryBtn: { height: 52, borderRadius: radii.md, backgroundColor: colors.brandBlue, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnDisabled: { backgroundColor: colors.disabled },
});
