import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Mobile caregiver "phone vibrates 30 seconds before each shift" feature.
 *
 * Background path: schedule a local notification per assignment via
 * expo-notifications. The OS fires it (with vibration + sound) even when
 * the app is backgrounded or the screen is locked.
 *
 * Idempotency: previously-scheduled IDs are persisted in expo-secure-store;
 * each call cancels them all before scheduling the fresh batch. Safe to
 * call on every dashboard refresh.
 *
 * Foreground path is handled separately in DashboardScreen with a
 * useEffect interval + Haptics.notificationAsync, see that file.
 */

const SCHEDULED_IDS_KEY = 'rayhealth_scheduled_shift_alerts_v1';
export const SHIFT_ALERT_CHANNEL_ID = 'shift-alerts';

/** Lead time before the shift's start at which the notification fires. */
const LEAD_TIME_MS = 30 * 1000;
/** Skip scheduling for triggers too close to "now" to avoid the OS firing instantly. */
const SCHEDULING_BUFFER_MS = 5_000;
/** Vibration pattern for the notification (Android, iOS uses default vibration). */
const VIBRATION_PATTERN: number[] = [0, 500, 200, 500, 200, 500];

export interface Assignment {
  id: string;
  clientName: string;
  time?: string;
  serviceCode?: string;
}

interface ShiftAlertData extends Record<string, unknown> {
  assignmentId: string;
  clientName: string;
  scheduledTime: string;
  serviceCode: string;
}

/**
 * Read the list of notification IDs we previously scheduled. Returns []
 * on any parse error so a corrupt blob doesn't break the next schedule cycle.
 */
async function readTrackedIds(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(SCHEDULED_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

async function writeTrackedIds(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(SCHEDULED_IDS_KEY, JSON.stringify(ids));
}

async function cancelTrackedNotifications(): Promise<void> {
  const ids = await readTrackedIds();
  await Promise.all(
    ids.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // Notification may have already fired or been canceled, fine to ignore.
      }
    })
  );
}

/**
 * Register the Android notification channel for shift alerts. Required for
 * the vibration pattern + MAX importance to take effect on Android. iOS
 * ignores channels. Safe to call repeatedly. Android coalesces.
 */
export async function ensureShiftAlertChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SHIFT_ALERT_CHANNEL_ID, {
    name: 'Shift alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: VIBRATION_PATTERN,
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    // PRIVATE, not PUBLIC: the notification body is `${clientName} · ${code}`,
    // which is PHI (patient identity + that they receive a specific service).
    // PRIVATE still surfaces the alert on a locked screen but redacts its
    // content until the device is unlocked, so it isn't disclosed to bystanders.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    description: 'Reminders fired 30 seconds before each scheduled shift.'
  });
}

function buildBody(clientName: string, serviceCode: string | undefined): string {
  return serviceCode ? `${clientName} · ${serviceCode}` : clientName;
}

/**
 * Schedule a one-shot local notification 30 seconds before each assignment
 * with a parseable ISO `time`. Idempotent: cancels prior batch first.
 *
 * No-op for assignments missing `time`, malformed times, or shifts whose
 * 30-second-prior trigger is already < 5 seconds away (or in the past).
 */
export async function scheduleShiftAlerts(assignments: Assignment[]): Promise<void> {
  await ensureShiftAlertChannel();
  await cancelTrackedNotifications();

  const now = Date.now();
  const minTriggerAt = now + SCHEDULING_BUFFER_MS;
  const newIds: string[] = [];

  for (const a of assignments) {
    if (!a.time) continue;
    const shiftStart = new Date(a.time).getTime();
    if (!Number.isFinite(shiftStart)) continue;
    const triggerAt = shiftStart - LEAD_TIME_MS;
    if (triggerAt <= minTriggerAt) continue;

    const data: ShiftAlertData = {
      assignmentId: a.id,
      clientName: a.clientName,
      scheduledTime: a.time,
      serviceCode: a.serviceCode ?? ''
    };

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Shift starts in 30 seconds',
          body: buildBody(a.clientName, a.serviceCode),
          data,
          sound: 'default',
          vibrate: VIBRATION_PATTERN,
          priority: Notifications.AndroidNotificationPriority.MAX
        },
        trigger:
          Platform.OS === 'android'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(triggerAt),
                channelId: SHIFT_ALERT_CHANNEL_ID
              }
            : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerAt) }
      });
      newIds.push(id);
    } catch (err) {
      // Don't fail the whole batch if one notification fails to schedule , 
      // e.g. permission revoked between requestPermissionsAsync and now.
      if (__DEV__) {
        console.log('Failed to schedule shift alert', a.id, err);
      }
    }
  }

  await writeTrackedIds(newIds);
}

/**
 * Cancel every shift-alert we have tracked and clear the persisted list.
 * Useful on logout so a logged-out device doesn't keep vibrating.
 */
export async function cancelAllShiftAlerts(): Promise<void> {
  await cancelTrackedNotifications();
  await writeTrackedIds([]);
}

/**
 * __DEV__-only helper. Fires a notification ~5s in the future so the
 * permission/channel/vibration plumbing can be exercised without waiting
 * for a real shift to come up.
 */
export async function fireDevTestShiftAlert(): Promise<string | null> {
  if (!__DEV__) return null;
  await ensureShiftAlertChannel();
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Shift starts in 30 seconds',
        body: 'Test client · TEST',
        data: {
          assignmentId: 'dev-test',
          clientName: 'Test client',
          scheduledTime: new Date(Date.now() + 35_000).toISOString(),
          serviceCode: 'TEST'
        },
        sound: 'default',
        vibrate: VIBRATION_PATTERN,
        priority: Notifications.AndroidNotificationPriority.MAX
      },
      trigger:
        Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(Date.now() + 5_000),
              channelId: SHIFT_ALERT_CHANNEL_ID
            }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + 5_000) }
    });
  } catch (err) {
    if (__DEV__) console.log('Dev test shift alert failed', err);
    return null;
  }
}
