import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, Button, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace('/(tabs)/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>RayHealth EVV</Text>
      <TextInput style={styles.input} placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isSubmitting ? <ActivityIndicator /> : <Button title="Login" onPress={handleLogin} disabled={!email || !password} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#f0f4f8' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 24, color: '#1a5fa8' },
  input: {
    height: 50,
    borderColor: '#c9d8e8',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white'
  },
  error: { color: '#b91c1c', marginBottom: 12, textAlign: 'center' }
});
