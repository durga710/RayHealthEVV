/**
 * Outbound notification dispatch.
 *
 * Sits between "something happened" and the delivery channels, so callers say
 * what happened and this decides who hears about it and how. Two channels
 * today, push and SMS, resolved from one recipient list.
 *
 * Preference model: `users.notification_prefs` holds per-category switches
 * (visitReminders, scheduleChanges, trainingDue, ...) and per-channel
 * switches (channelPush, channelEmail, channelSms). A notification is
 * delivered only when BOTH the category and the channel are on. Absent
 * preferences default to ON, matching the existing settings UI, where an
 * untouched account shows every switch enabled.
 *
 * Recipients come from the caregiver list rather than from registered
 * devices, because a caregiver who never installed the app still has a phone
 * number and SMS is exactly the channel that reaches them.
 *
 * PHI RULE: nothing assembled here may put client names, addresses, or visit
 * detail into a title or body. A push renders on a locked screen, and SMS is
 * worse still, unencrypted across carrier infrastructure and retained outside
 * any BAA we hold. Both channels carry a nudge to open the app; the payload
 * carries ids the app routes with after the caregiver unlocks and
 * authenticates. See push-client.ts and sms-client.ts.
 */
import type { Knex } from 'knex';
import { PushTokenRepository } from '@rayhealth/core';
import { getPushClient, type PushSendResult } from '../push/push-client.js';
import { getSmsClient, toE164 } from '../sms/sms-client.js';
import { safeError } from '../security/safe-log.js';

/** Notification categories, aligned with the settings UI switches. */
export type NotificationCategory =
  | 'visitReminders'
  | 'scheduleChanges'
  | 'trainingDue'
  | 'billingAlerts'
  | 'productUpdates';

export interface NotifyCaregiversInput {
  agencyId: string;
  caregiverIds: string[];
  category: NotificationCategory;
  title: string;
  body: string;
  /** Routing hints only. Never PHI. */
  data?: Record<string, string>;
  channelId?: string;
  /**
   * Text used for SMS instead of `body`. SMS has no title, so the push body
   * alone often reads without context ("One of your shifts changed" arriving
   * from an unknown number). Callers that opt into SMS should supply a
   * self-contained line. Still generic, still never PHI.
   */
  smsBody?: string;
  /**
   * Whether this notification is worth a text message. Off by default: SMS
   * costs money per message and is far more intrusive than a push, so it is
   * reserved for things a caregiver needs to know while the app is closed.
   */
  alsoSms?: boolean;
}

export interface NotifyResult extends PushSendResult {
  smsSent: number;
  smsFailed: number;
}

/**
 * Preferences that default to OFF when the user has never touched them.
 *
 * SMS is opt-in, matching what the settings page shows: it costs money per
 * message, interrupts harder than a push, and texting somebody who never
 * asked to be texted is the kind of thing consent rules exist about. Every
 * other switch defaults on, so an account that never opened settings still
 * gets its shift reminders.
 */
const DEFAULT_OFF = new Set(['channelSms']);

/** True unless the user (or the default above) has it switched off. */
function prefEnabled(prefs: Record<string, unknown> | null, key: string): boolean {
  const fallback = !DEFAULT_OFF.has(key);
  if (!prefs) return fallback;
  const value = prefs[key];
  return value === undefined || value === null ? fallback : value !== false;
}

interface UserPrefRow {
  id: string;
  caregiver_id: string | null;
  notification_prefs: Record<string, unknown> | null;
  phone: string | null;
  caregiver_phone: string | null;
}

function parsePrefs(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

/**
 * Notify a set of caregivers in one agency, across every channel they have
 * opted into.
 *
 * Never throws: a notification is a courtesy layered on top of whatever the
 * caller was really doing, and must not fail a clock-in or a schedule change
 * because a device token went stale or a carrier was unreachable.
 */
export async function notifyCaregivers(
  db: Knex,
  input: NotifyCaregiversInput,
): Promise<NotifyResult> {
  const empty: NotifyResult = { sent: 0, failed: 0, invalidTokens: [], smsSent: 0, smsFailed: 0 };
  if (input.caregiverIds.length === 0) return empty;

  try {
    // Recipients are resolved from the caregivers themselves, not from
    // registered devices: a caregiver who never installed the app still has a
    // phone number, and SMS is exactly the channel that reaches them.
    // Tenant-scoped by agency on both sides of the join.
    const rows = (await db('users as u')
      .leftJoin('caregivers as c', 'c.id', 'u.caregiver_id')
      .whereIn('u.caregiver_id', input.caregiverIds)
      .andWhere('u.agency_id', input.agencyId)
      .select(
        'u.id',
        'u.caregiver_id',
        'u.notification_prefs',
        'u.phone',
        'c.phone as caregiver_phone',
      )) as UserPrefRow[];
    if (rows.length === 0) return empty;

    const categoryAllowed = rows.filter((row) =>
      prefEnabled(parsePrefs(row.notification_prefs), input.category),
    );
    if (categoryAllowed.length === 0) return empty;

    const [push, sms] = await Promise.all([
      sendPush(db, input, categoryAllowed),
      sendSms(input, categoryAllowed),
    ]);

    return { ...push, ...sms };
  } catch (err) {
    safeError('notifyCaregivers failed', err);
    return empty;
  }
}

/** Push half of {@link notifyCaregivers}. Failures degrade to zero counts. */
async function sendPush(
  db: Knex,
  input: NotifyCaregiversInput,
  recipients: UserPrefRow[],
): Promise<PushSendResult> {
  const empty: PushSendResult = { sent: 0, failed: 0, invalidTokens: [] };
  try {
    const allowed = recipients.filter((row) =>
      prefEnabled(parsePrefs(row.notification_prefs), 'channelPush'),
    );
    if (allowed.length === 0) return empty;

    const tokenRepo = new PushTokenRepository(db);
    const tokens = await tokenRepo.listForCaregivers(input.agencyId, input.caregiverIds);
    const allowedUserIds = new Set(allowed.map((row) => row.id));
    const deliverable = tokens.filter((t) => allowedUserIds.has(t.userId)).map((t) => t.token);
    if (deliverable.length === 0) return empty;

    const result = await getPushClient().send({
      tokens: deliverable,
      title: input.title,
      body: input.body,
      data: input.data,
      channelId: input.channelId,
    });

    // Retire tokens the push service says are gone, so we stop paying to
    // notify an app that was uninstalled.
    if (result.invalidTokens.length > 0) {
      await tokenRepo.disableTokens(result.invalidTokens, 'DeviceNotRegistered');
    }
    return result;
  } catch (err) {
    safeError('push notification failed', err);
    return empty;
  }
}

/**
 * SMS half of {@link notifyCaregivers}. Opt-in per call (`alsoSms`) because a
 * text costs money and interrupts harder than a push does.
 *
 * A caregiver with no usable phone number is skipped silently rather than
 * counted as a failure: most caregivers are reachable by push, and an agency
 * that never collected phone numbers should not see a wall of errors.
 */
async function sendSms(
  input: NotifyCaregiversInput,
  recipients: UserPrefRow[],
): Promise<{ smsSent: number; smsFailed: number }> {
  if (!input.alsoSms) return { smsSent: 0, smsFailed: 0 };

  try {
    const numbers = new Set<string>();
    for (const row of recipients) {
      if (!prefEnabled(parsePrefs(row.notification_prefs), 'channelSms')) continue;
      // The user's own number wins; the caregiver record is the fallback for
      // staff whose login was created after their caregiver row.
      const e164 = toE164(row.phone) ?? toE164(row.caregiver_phone);
      if (e164) numbers.add(e164);
    }
    if (numbers.size === 0) return { smsSent: 0, smsFailed: 0 };

    const client = getSmsClient();
    const body = input.smsBody ?? input.body;
    let smsSent = 0;
    let smsFailed = 0;
    for (const to of numbers) {
      const result = await client.send({ to, body });
      if (result.ok) smsSent += 1;
      else smsFailed += 1;
    }
    return { smsSent, smsFailed };
  } catch (err) {
    safeError('sms notification failed', err);
    return { smsSent: 0, smsFailed: 0 };
  }
}
