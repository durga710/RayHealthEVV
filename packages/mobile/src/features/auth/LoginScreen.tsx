import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/AuthContext';
import { Redirect } from 'expo-router';
import { colors, typography, radii, shadow, gradients } from '../common/tokens';

export default function LoginScreen() {
  const { login, isAuthenticated, needsAgencySelection } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // NOTE: no focus-tracking state on this screen. Any setState fired from
  // onFocus re-renders mid-keyboard-open and blurs the field (the "flashing
  // inputs" bug). Focus styling here must be state-free or not at all.

  // Keep the focused field visible above the soft keyboard. When the keyboard
  // opens, scroll the (short) form to the end so both inputs and the sign-in
  // button sit above it. This uses a scroll ref only, no state change, so it
  // can't reintroduce the focus-blur bug we fixed earlier.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  // If the app ever lands on the login route while a valid session already
  // exists (e.g. a reload restoring the last route), don't strand the user on
  // the login form. Multi-agency accounts that haven't picked an agency for
  // this session go to the picker; everyone else goes straight to the
  // dashboard. This same Redirect also fires right after login() flips
  // isAuthenticated, so no imperative navigation is needed in handleLogin.
  if (isAuthenticated) {
    return <Redirect href={needsAgencySelection ? '/select-agency' : '/(tabs)/dashboard'} />;
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setError('');
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      // Navigation is handled by the Redirect above once isAuthenticated
      // flips, it routes to /select-agency for multi-agency accounts and to
      // the dashboard otherwise, so there's no race between the two paths.
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Invalid email or password. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={gradients.hero} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brandBlock}>
            <View style={styles.logoRing}>
              <Image
                source={require('../../../assets/images/rayhealthevv-mark.png')}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="RayHealthEVV logo"
              />
            </View>
            <Text style={styles.appName}>RayHealthEVV™</Text>
            <Text style={styles.tagline}>Electronic Visit Verification</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to your account</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.onGradientFaint} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.placeholder}
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
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.onGradientFaint} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  editable={!isSubmitting}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.onGradientFaint}
                  />
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} style={styles.errorIcon} />
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
                colors={canSubmit ? gradients.cta : gradients.ctaDisabled}
                style={styles.loginBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.loginBtnRow}>
                    <Text style={styles.loginBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </View>
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
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#ffffff40',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  logoImage: { width: 72, height: 72 },
  appName: {
    ...typography.hero, color: '#fff',
    textShadowColor: '#00000040',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  tagline: { ...typography.sub, color: colors.onGradientSoft, marginTop: 4, letterSpacing: 0.5 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.hero,
    padding: 28,
    ...shadow.raised,
    marginBottom: 28,
  },
  cardTitle: {
    fontSize: 20, fontWeight: '800', color: colors.textPrimary,
    marginBottom: 24, textAlign: 'center',
  },

  fieldGroup: { marginBottom: 18 },
  label: {
    ...typography.label, color: colors.textSecondary,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderColor: colors.inputBorder,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.inputBg,
    gap: 10,
  },
  inputWrapFocused: {
    borderColor: colors.brandBlue,
    backgroundColor: '#f0f6ff',
    shadowColor: colors.brandBlue,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  input: { flex: 1, fontSize: 16, color: colors.inputText },
  eyeBtn: { padding: 4 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: radii.sm,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorIcon: { marginTop: 1 },
  errorText: { flex: 1, color: colors.danger, ...typography.sub, lineHeight: 19 },

  loginBtnWrap: { borderRadius: radii.md, overflow: 'hidden', marginTop: 4 },
  loginBtn: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.md,
  },
  loginBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  footer: { alignItems: 'center', gap: 10 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  secureDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  secureText: {
    color: colors.onGradientSoft, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  footerNote: { color: colors.onGradientFaint, fontSize: 12 },
});
