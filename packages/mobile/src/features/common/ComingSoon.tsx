import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Temporary placeholder used by tabs whose screen is still being built, so the
// bottom-tab navigation can ship before every tab is filled in.
export default function ComingSoon({
  title,
  icon,
  note,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  note?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>{title}</Text>
      </LinearGradient>
      <View style={styles.body}>
        <Ionicons name={icon} size={44} color="#9db3c8" />
        <Text style={styles.bodyTitle}>Coming soon</Text>
        <Text style={styles.bodyNote}>{note ?? 'This section is on the way.'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 24 },
  bodyTitle: { fontSize: 18, fontWeight: '900', color: '#0f2d52', marginTop: 8 },
  bodyNote: { fontSize: 14, color: '#5a7088', textAlign: 'center', lineHeight: 20 },
});
