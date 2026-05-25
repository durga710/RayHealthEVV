import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const REMINDER_PERMISSION_ASKED_KEY = 'rayhealth_reminder_permission_asked';

/**
 * Requests OS notification permission for clock-in/out reminders.
 *
 * Design decisions:
 * - Asks only once per device installation (persisted via SecureStore).
 * - Should be called after the caregiver's first successful clock-in,
 *   not at app launch — we wait for genuine user intent (per Apple HIG
 *   and the existing "deferred notification permission" pattern in the
 *   handoff docs from 2026-05-09).
 * - Safe to call on any platform (expo-notifications is a no-op on web).
 *
 * Returns:
 *   'granted'     — permission was granted (or was already granted)
 *   'denied'      — user declined
 *   'already_asked' — prior call recorded; OS was not re-prompted
 */
export type PermissionOutcome = 'granted' | 'denied' | 'already_asked';

export async function requestClockReminderPermission(): Promise<PermissionOutcome> {
  // Prevent re-asking: once the user has been asked, respect their decision
  const alreadyAsked = await SecureStore.getItemAsync(REMINDER_PERMISSION_ASKED_KEY);
  if (alreadyAsked) return 'already_asked';

  // Record that we're about to ask — write before the dialog so a crash
  // during the dialog doesn't leave us in a re-asking loop.
  await SecureStore.setItemAsync(REMINDER_PERMISSION_ASKED_KEY, '1');

  const result = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
    },
  });

  return result.granted ? 'granted' : 'denied';
}
