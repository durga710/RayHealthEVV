import React, { useState, useRef } from 'react';
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
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setError('');
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/dashboard');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand header */}
        <View style={styles.brandBlock}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <Text style={styles.appName}>RayHealth EVV</Text>
          <Text style={styles.tagline}>Electronic Visit Verification</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Caregiver Sign In</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9ab0c8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#9ab0c8"
              secureTextEntry
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              editable={!isSubmitting}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              !canSubmit && styles.loginBtnDisabled,
              pressed && canSubmit && styles.loginBtnPressed,
            ]}
            onPress={handleLogin}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.secureRow}>
            <View style={styles.secureDot} />
            <Text style={styles.secureText}>Secured by RayHealth</Text>
          </View>
          <Text style={styles.footerNote}>
            Admin access is available at{'\n'}rayhealthevv.com
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PRIMARY = '#1a5fa8';
const PRIMARY_DARK = '#144c89';

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f0f4f8' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  brandBlock: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logoText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  appName: { fontSize: 26, fontWeight: '800', color: '#1a3a5c', letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: '#5b8fc9', marginTop: 4, letterSpacing: 0.3 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1a3a5c', marginBottom: 20 },

  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4a6480',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    borderColor: '#c9d8e8',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1a3a5c',
    backgroundColor: '#f8fafc',
  },

  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: { color: '#b91c1c', fontSize: 14 },

  loginBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  loginBtnPressed: { backgroundColor: PRIMARY_DARK },
  loginBtnDisabled: { backgroundColor: '#93b5d9', shadowOpacity: 0, elevation: 0 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  footer: { alignItems: 'center', gap: 8 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  secureText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  footerNote: { color: '#8ba7c2', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
