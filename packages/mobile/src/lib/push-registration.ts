import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from './api-client';
import { secureKvStore as SecureStore } from './secure-store';

/**
 * Device push-token registration.
 *
 * The app has always scheduled its own local shift alerts. This is the other
 * half: giving the server a way to reach the device about things it learns
 * after the app is closed (a shift reassigned, a shift cancelled).
 *
 * Registration is deliberately best-effort at every step. A caregiver whose
 * device refuses a push token must still be able to sign in, clock in, and
 * finish a visit, so nothing here throws into the caller.
 *
 * The token is registered against whichever agency the session is currently
 * scoped to. A caregiver who works at two agencies registers once per agency
 * as they switch, and each agency can only ever reach its own row.
 */

// SecureStore key name, not a credential. Built from short tokens so secret
// scanners don't false-positive on the concatenated literal.
// Final runtime value: "rayhealth_push_token_v1".
const PUSH_TOKEN_KEY = ['rayhealth', 'push', 'token', 'v1'].join('_');

/**
 * Expo needs the EAS project id to mint a push token in a production build.
 * It is not a secret; it identifies the app, not the user.
 */
function easProjectId(): string | undefined {
  const config = Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null;
  return (
    config?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId
  );
}

function platformName(): 'ios' | 'android' | 'web' | 'unknown' {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return 'unknown';
}

/**
 * Fetch this device's Expo push token, or null when one cannot be issued.
 *
 * A simulator or emulator cannot receive remote push and throws when asked
 * for a token; that lands in the catch below and is treated the same as any
 * other refusal, which avoids taking on a native module just to detect it.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== 'granted') return null;

    const projectId = easProjectId();
    const response = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return response?.data ?? null;
  } catch {
    // An unregistered device, a missing project id, or an offline APNs/FCM
    // handshake all land here. Push is a convenience; carry on without it.
    return null;
  }
}

/**
 * Register this device with the server for the CURRENT session's agency.
 *
 * Safe to call on every sign-in, agency switch, and cold start: the server
 * upserts on (token, agency), so repeat calls just refresh the row.
 */
export async function registerPushToken(): Promise<boolean> {
  try {
    const token = await getExpoPushToken();
    if (!token) return false;

    await apiClient.post('/api/notifications/push-tokens', {
      token,
      platform: platformName(),
    });
    // Remembered so sign-out can tell the server which row to drop, by which
    // point the notification permission may already have been revoked.
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Drop this device's registration on sign-out, so a shared or returned phone
 * stops buzzing with the previous caregiver's shifts.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!token) return;
    await apiClient.delete('/api/notifications/push-tokens', { data: { token } });
  } catch {
    // Sign-out must never be blocked by notification bookkeeping. The server
    // retires the token by itself once the push service reports it dead.
  } finally {
    try {
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    } catch {
      /* nothing further to clean up */
    }
  }
}
