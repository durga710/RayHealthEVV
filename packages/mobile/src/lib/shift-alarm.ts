// In-app shift alarm: the full-screen "your shift starts soon" overlay.
//
// Module-level controller registered by <ShiftAlarmHost/> in app/_layout.tsx,
// same imperative-singleton pattern as appAlert.ts: both trigger paths are
// plain functions with no component to call a hook from.
//
// Two triggers converge here:
//   1. app/_layout.tsx, addNotificationReceivedListener: the OS-scheduled
//      local notification is delivered while the app is foregrounded (any
//      screen). The notification handler suppresses the system banner for
//      shift alerts in the foreground and this overlay shows instead; the
//      notification's alarm chime still plays.
//   2. DashboardScreen's foreground tick: covers environments where local
//      notifications are unavailable (Expo Go on Android) while the
//      dashboard is open.
// Deduping by assignment + scheduled start keeps the overlay to a single
// presentation per shift no matter which trigger lands first, or how many
// times a tick re-fires inside the alert window.

export interface ShiftAlarmPayload {
  assignmentId: string;
  clientName: string;
  /** ISO timestamp of the scheduled shift start. */
  scheduledTime: string;
  serviceCode?: string;
  clientAddress?: string;
}

interface ShiftAlarmController {
  present: (payload: ShiftAlarmPayload) => void;
}

let controller: ShiftAlarmController | null = null;
const presentedKeys = new Set<string>();

export function __registerShiftAlarmController(next: ShiftAlarmController | null): void {
  controller = next;
}

/**
 * Runtime guard for untyped sources (notification `data` blobs). Optional
 * fields may be absent but must be strings when present.
 */
export function isShiftAlarmPayload(value: unknown): value is ShiftAlarmPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.assignmentId !== 'string' || v.assignmentId.length === 0) return false;
  if (typeof v.clientName !== 'string') return false;
  if (typeof v.scheduledTime !== 'string') return false;
  if (v.serviceCode !== undefined && typeof v.serviceCode !== 'string') return false;
  if (v.clientAddress !== undefined && typeof v.clientAddress !== 'string') return false;
  return true;
}

/** One overlay per shift occurrence: same assignment at a new time re-alarms. */
export function shiftAlarmKey(payload: Pick<ShiftAlarmPayload, 'assignmentId' | 'scheduledTime'>): string {
  return `${payload.assignmentId}@${payload.scheduledTime}`;
}

/**
 * Present the overlay for this shift. Returns true when the overlay was
 * actually presented; false when no host is mounted yet or this shift
 * occurrence already alarmed. A missing host does NOT consume the dedup
 * slot, so a trigger that races the host's mount can succeed on retry.
 */
export function presentShiftAlarm(payload: ShiftAlarmPayload): boolean {
  if (!controller) return false;
  const key = shiftAlarmKey(payload);
  if (presentedKeys.has(key)) return false;
  presentedKeys.add(key);
  controller.present(payload);
  return true;
}

/** Test hook: clear the per-run dedup memory. */
export function __resetPresentedShiftAlarms(): void {
  presentedKeys.clear();
}
