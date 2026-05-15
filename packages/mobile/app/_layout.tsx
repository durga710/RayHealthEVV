import { Stack } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/lib/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootContent />
    </AuthProvider>
  );
}

function RootContent() {
  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <SessionRevokedBanner />
    </View>
  );
}

function SessionRevokedBanner() {
  const { sessionRevokedMessage, dismissSessionRevoked } = useAuth();
  if (!sessionRevokedMessage) return null;
  return (
    <View pointerEvents="box-none" style={styles.bannerContainer}>
      <Pressable
        onPress={dismissSessionRevoked}
        hitSlop={8}
        accessibilityRole="alert"
        accessibilityLabel={sessionRevokedMessage}
        style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
      >
        <Text style={styles.bannerText}>{sessionRevokedMessage}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    paddingHorizontal: 16
  },
  banner: {
    minHeight: 44,
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4
  },
  bannerPressed: { opacity: 0.85 },
  bannerText: { color: 'white', fontSize: 14, fontWeight: '500', textAlign: 'center' }
});
