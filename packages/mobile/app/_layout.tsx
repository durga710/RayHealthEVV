import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { LogBox, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/lib/AuthContext';

// Expo Go (SDK 53+) removed remote push support, so expo-notifications' push-
// token auto-registration logs a warning the moment the module is imported.
// We only use LOCAL scheduled notifications (shift alerts), which still work in
// Expo Go — so this message is expected noise *only* while running inside Expo
// Go. It does NOT fire in a dev/production build, where remote push is
// available, so scope the suppression to Expo Go to keep real push problems
// visible everywhere else.
if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
  LogBox.ignoreLogs([
    'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
  ]);
}

// Show shift-alert notifications even when the app is foregrounded so the
// system banner + sound + vibration still fire. We mirror the haptic
// independently from the dashboard tick, but letting the banner show is the
// cue the user expects.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

interface ShiftAlertPayload {
  assignmentId: string;
  clientName: string;
  scheduledTime: string;
  serviceCode: string;
}

function isShiftAlertPayload(value: unknown): value is ShiftAlertPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.assignmentId === 'string' &&
    typeof v.clientName === 'string' &&
    typeof v.scheduledTime === 'string' &&
    typeof v.serviceCode === 'string'
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootContent />
    </AuthProvider>
  );
}

function RootContent() {
  const router = useRouter();

  // Deep-link on notification tap. Pull the assignment data we embedded when
  // scheduling and route to /clockin with the same param shape the dashboard
  // Pressable uses, so the clock-in screen renders identically regardless of
  // entry point.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!isShiftAlertPayload(data)) return;
      router.push({
        pathname: '/clockin',
        params: {
          assignmentId: data.assignmentId,
          clientName: data.clientName,
          scheduledTime: data.scheduledTime,
          serviceCode: data.serviceCode
        }
      });
    });
    return () => sub.remove();
  }, [router]);

  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
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
