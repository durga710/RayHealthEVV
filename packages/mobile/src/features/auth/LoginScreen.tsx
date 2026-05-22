import React, { useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar
} from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setError('');
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/dashboard');
    } catch (err) {
      console.error('Login error', err);
      setError('Invalid email or password. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrefillFixture = () => {
    setEmail('test-caregiver-fixture@rayhealthevv.local');
    setPassword('TestCaregiver2026!');
    setError('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1248a0" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Header Branding Panel */}
          <View style={styles.brandingPanel}>
            <View style={styles.logoBadge}>
              <Ionicons name="shield-checkmark" size={44} color="#f97316" />
            </View>
            <Text style={styles.brandName}>RayHealth EVV</Text>
            <Text style={styles.brandSubtitle}>Pennsylvania DHS Electronic Visit Verification</Text>
          </View>

          {/* Login Card Wrapper */}
          <View style={styles.loginCard}>
            <Text style={styles.loginCardTitle}>Caregiver Portal Sign In</Text>

            {/* Email Field */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Caregiver Email Address"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => { setEmail(text); setError(''); }}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Account Password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(text) => { setPassword(text); setError(''); }}
              />
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Primary Action Button */}
            {isSubmitting ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.loaderText}>Verifying credential keys...</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.loginButton, (!email || !password) && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={!email || !password}
              >
                <Text style={styles.loginButtonText}>AUTHENTICATE & LOG IN</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </Pressable>
            )}
          </View>

          {/* Test Fixture Credentials Quick-Fill Assistant */}
          <View style={styles.fixtureCard}>
            <View style={styles.fixtureHeader}>
              <Ionicons name="flask" size={16} color="#1a5fa8" />
              <Text style={styles.fixtureTitle}>Quick-reference Test Fixture</Text>
            </View>
            <Text style={styles.fixtureBody}>
              Use our pre-seeded synthetic caregiver account to safely smoke-test EVV geofencing, duty task attestations, and AI support responses:
            </Text>
            
            <View style={styles.fixtureInfoBox}>
              <Text style={styles.fixtureLabel}>EMAIL: </Text>
              <Text style={styles.fixtureValue}>test-caregiver-fixture@rayhealthevv.local</Text>
            </View>
            <View style={styles.fixtureInfoBox}>
              <Text style={styles.fixtureLabel}>PASSWORD: </Text>
              <Text style={styles.fixtureValue}>TestCaregiver2026!</Text>
            </View>

            <Pressable style={styles.prefillButton} onPress={handlePrefillFixture}>
              <Ionicons name="copy-outline" size={14} color="#ffffff" />
              <Text style={styles.prefillButtonText}>AUTO PRE-FILL FIXTURE CREDENTIALS</Text>
            </Pressable>
          </View>

          {/* Immutable HIPAA warning */}
          <View style={styles.hipaaContainer}>
            <Ionicons name="lock-closed" size={12} color="#5b8fc9" />
            <Text style={styles.hipaaText}>
              RayHealth systems strictly enforce HIPAA-grade security controls. All access attempts are recorded in an immutable ledger.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1248a0' // Premium RayHealth Deep Blue base
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40
  },
  brandingPanel: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 20 : 40,
    marginBottom: 24
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#bdd3f0',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 20
  },
  loginCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1a3a5c',
    marginBottom: 16,
    textAlign: 'center'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    height: 52
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    color: '#1a3a5c',
    fontSize: 14,
    fontWeight: '600'
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 10,
    borderRadius: 8,
    gap: 6,
    marginBottom: 14
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
    flex: 1
  },
  loginButton: {
    backgroundColor: '#f97316', // Premium Brand Orange Accent
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4
  },
  loginButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 10
  },
  loaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 8
  },
  fixtureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'rgba(26, 95, 168, 0.25)',
    marginBottom: 20
  },
  fixtureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  fixtureTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1a5fa8',
    letterSpacing: 0.3
  },
  fixtureBody: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 12,
    fontWeight: '500'
  },
  fixtureInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 6
  },
  fixtureLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#475569'
  },
  fixtureValue: {
    fontSize: 9,
    fontWeight: '950',
    color: '#1e293b',
    fontFamily: 'monospace'
  },
  prefillButton: {
    backgroundColor: '#1a5fa8',
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    shadowColor: '#1a5fa8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2
  },
  prefillButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  hipaaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    opacity: 0.7,
    marginTop: 10
  },
  hipaaText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#bdd3f0',
    textAlign: 'center',
    lineHeight: 13,
    flex: 1
  }
});
