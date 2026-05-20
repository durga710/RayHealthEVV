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
import { LinearGradient } from 'expo-linear-gradient';
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
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

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
    <LinearGradient colors={['#0f2d52', '#1a5fa8', '#2d7dd2']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brandBlock}>
            <View style={styles.logoRing}>
              <LinearGradient
                colors={['#ffffff30', '#ffffff08']}
                style={styles.logoGradient}
              >
                <Text style={styles.logoText}>R</Text>
              </LinearGradient>
            </View>
            <Text style={styles.appName}>RayHealth EVV</Text>
            <Text style={styles.tagline}>Electronic Visit Verification</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to your account</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={[styles.inputWrap, emailFocused && styles.inputWrapFocused]}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#b0c4d8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  editable={!isSubmitting}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrap, passFocused && styles.inputWrapFocused]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#b0c4d8"
                  secureTextEntry
                  returnKeyType="go"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  editable={!isSubmitting}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.loginBtnWrap,
                pressed && canSubmit && { opacity: 0.9 },
              ]}
              onPress={handleLogin}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              <LinearGradient
                colors={canSubmit ? ['#1a5fa8', '#0f3d72'] : ['#8aaac8', '#6e90ad']}
                style={styles.loginBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginBtnText}>Sign In →</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.secureRow}>
              <View style={styles.secureDot} />
              <Text style={styles.secureText}>HIPAA-Secured · PA EVV Compliant</Text>
            </View>
            <Text style={styles.footerNote}>Admin portal at rayhealthevv.com</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  brandBlock: { alignItems: 'center', marginBottom: 36 },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#ffffff40',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  logoGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: { color: '#fff', fontSize: 42, fontWeight: '900' },
  appName: {
    fontSize: 28, fontWeight: '900', color: '#fff',
    letterSpacing: -0.5, textShadowColor: '#00000040',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  tagline: { fontSize: 13, color: '#a8c8e8', marginTop: 4, letterSpacing: 0.5 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    marginBottom: 28,
  },
  cardTitle: {
    fontSize: 20, fontWeight: '800', color: '#0f2d52',
    marginBottom: 24, textAlign: 'center',
  },

  fieldGroup: { marginBottom: 18 },
  label: {
    fontSize: 11, fontWeight: '700', color: '#4a6480',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderColor: '#dce8f2',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f7fafd',
    gap: 10,
  },
  inputWrapFocused: {
    borderColor: '#1a5fa8',
    backgroundColor: '#f0f6ff',
    shadowColor: '#1a5fa8',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  inputIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 16, color: '#1a3a5c' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorIcon: { fontSize: 14, marginTop: 1 },
  errorText: { flex: 1, color: '#b91c1c', fontSize: 13, lineHeight: 19 },

  loginBtnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  loginBtn: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  loginBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  footer: { alignItems: 'center', gap: 10 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  secureDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  secureText: {
    color: '#a8c8e8', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  footerNote: { color: '#6898c0', fontSize: 12 },
});
