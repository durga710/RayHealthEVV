import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { LogBox, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/lib/AuthContext';
import { useOfflineEvvSync } from '../src/lib/use-offline-sync';
import AppAlertProvider from '../src/features/common/alerts/AppAlertProvider';
import { showAppToast } from '../src/features/common/alerts/appAlert';

// Expo Go (SDK 53+) removed remote push support, so expo-notifications' push-
// token auto-registration logs a warning the moment the module is imported.
// We only use LOCAL scheduled notifications (shift alerts), which still work in
// Expo Go, so this message is expected noise *only* while running inside Expo
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
  const { isAuthenticated, sessionRevokedMessage } = useAuth();

  // Replay offline-captured EVV punches on launch, on connectivity regained,
  // and on foreground, only while authenticated (replaying into 401s would
  // waste attempts before the session is restored).
  useOfflineEvvSync(isAuthenticated);

  // Session-revoked notices now route through the branded toast system
  // instead of the old bespoke slate-gray banner.
  useEffect(() => {
    if (sessionRevokedMessage) {
      showAppToast({ message: sessionRevokedMessage, variant: 'warning', durationMs: 5000 });
    }
  }, [sessionRevokedMessage]);

  // When the session is lost (logout, or a mid-use 401 revoke), reset the whole
  // stack to login. The (tabs) layout already redirects, but screens pushed
  // OVER the tabs, /clockin, /training, /course-player, /visit-detail,
  // /profile-details, /change-password, would otherwise strand the user on a
  // now-unauthorized
  // screen. Fire only on the authenticated→unauthenticated transition.
  const prevAuth = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuth.current && !isAuthenticated) {
      router.replace('/login');
    }
    prevAuth.current = isAuthenticated;
  }, [isAuthenticated, router]);

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
        <Stack.Screen name="select-agency" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="clockin" options={{ headerShown: false }} />
        <Stack.Screen name="training" options={{ headerShown: false }} />
        <Stack.Screen name="course-player" options={{ headerShown: false }} />
        <Stack.Screen name="visit-detail" options={{ headerShown: false }} />
        <Stack.Screen name="profile-details" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
      </Stack>
      <AppAlertProvider />
    </View>
  );
}
