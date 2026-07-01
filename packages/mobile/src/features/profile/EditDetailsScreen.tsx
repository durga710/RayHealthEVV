import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import apiClient from '../../lib/api-client';
import ScreenHeader from '../common/ScreenHeader';
import { showAppAlert, showAppToast } from '../common/alerts/appAlert';

interface Profile {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export default function EditDetailsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [original, setOriginal] = useState({ firstName: '', lastName: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await apiClient.get<Profile>('/api/profile');
        if (!active) return;
        setEmail(data.email ?? '');
        setFirstName(data.firstName ?? '');
        setLastName(data.lastName ?? '');
        setPhone(data.phone ?? '');
        setOriginal({ firstName: data.firstName ?? '', lastName: data.lastName ?? '', phone: data.phone ?? '' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const dirty =
    firstName !== original.firstName || lastName !== original.lastName || phone !== original.phone;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await apiClient.patch('/api/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      showAppToast({ message: "You're all set — your details have been updated.", variant: 'success' });
      router.back();
    } catch {
      showAppAlert('Could not save', 'Please check your connection and try again.', undefined, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Personal details" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a5fa8" />
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              {email ? (
                <>
                  <Text style={styles.label}>Email</Text>
                  <View style={[styles.input, styles.inputReadonly]}>
                    <Text style={styles.readonlyText} numberOfLines={1}>{email}</Text>
                  </View>
                  <Text style={styles.helper}>Contact your agency to change your email.</Text>
                </>
              ) : null}

              <Text style={styles.label}>First name</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor="#9db3c8" autoCapitalize="words" />

              <Text style={styles.label}>Last name</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor="#9db3c8" autoCapitalize="words" />

              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" placeholderTextColor="#9db3c8" keyboardType="phone-pad" />
            </View>

            <Pressable
              onPress={handleSave}
              disabled={!dirty || saving}
              style={({ pressed }) => [styles.primaryBtn, (!dirty || saving) && styles.btnDisabled, pressed && dirty && { opacity: 0.9 }]}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{dirty ? 'Save changes' : 'Saved'}</Text>}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    justifyContent: 'center',
  },
  inputReadonly: { backgroundColor: '#eef2f6', borderColor: '#e2e8f0' },
  readonlyText: { fontSize: 16, color: '#64748b' },
  helper: { fontSize: 12, color: '#8499ad', marginBottom: 6 },

  primaryBtn: { height: 52, borderRadius: 14, backgroundColor: '#1a5fa8', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnDisabled: { backgroundColor: '#a8bdd4' },
});
