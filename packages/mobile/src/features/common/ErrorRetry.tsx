import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Shown when a fetch genuinely FAILED (vs returned empty), so a network/server
// error isn't silently presented as "you have no data."
export default function ErrorRetry({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={40} color="#9db3c8" />
      <Text style={styles.title}>{"Couldn't load"}</Text>
      <Text style={styles.msg}>{message ?? 'Check your connection and try again.'}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Retry"
      >
        <Text style={styles.btnText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: '#0f2d52', marginTop: 8 },
  msg: { fontSize: 13, color: '#5a7088', textAlign: 'center', lineHeight: 19 },
  btn: { marginTop: 12, backgroundColor: '#1a5fa8', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
