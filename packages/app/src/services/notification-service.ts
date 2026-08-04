/**
 * Outbound notification dispatch.
 *
 * Sits between "something happened" and the delivery channels, so callers say
 * what happened and this decides who hears about it and how. Today that means
 * push; the same recipient/preference resolution is what an SMS or email
 * channel would hang off.
 *
 * Preference model: `users.notification_prefs` holds per-category switches
 * (visitReminders, scheduleChanges, trainingDue, ...) and per-channel
 * switches (channelPush, channelEmail, channelSms). A notification is
 * delivered only when BOTH the category and the channel are on. Absent
 * preferences default to ON, matching the existing settings UI, where an
 * untouched account shows every switch enabled.
 *
 * PHI RULE: nothing assembled here may put client names, addresses, or visit
 * detail into a title or body, because a push renders on a locked screen. The
 * payload carries ids for the app to route with after the caregiver unlocks
 * and authenticates. See push-client.ts.
 */
import type { Knex } from 'knex';
import { PushTokenRepository } from '@rayhealth/core';
import { getPushClient, type PushSendResult } from '../push/push-client.js';
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
}

/**
 * True unless the user has explicitly switched it off. An account that has
 * never opened the settings page has no stored prefs at all and should still
 * receive its shift reminders.
 */
function prefEnabled(prefs: Record<string, unknown> | null, key: string): boolean {
  if (!prefs) return true;
  const value = prefs[key];
  return value === undefined || value === null ? true : value !== false;
}

interface UserPrefRow {
  id: string;
  caregiver_id: string | null;
  notification_prefs: Record<string, unknown> | null;
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
 * Push one notification to a set of caregivers in one agency.
 *
 * Never throws: a notification is a courtesy layered on top of whatever the
 * caller was really doing, and must not fail a clock-in or a schedule change
 * because a device token went stale.
 */
export async function notifyCaregivers(
  db: Knex,
  input: NotifyCaregiversInput,
): Promise<PushSendResult> {
  const empty: PushSendResult = { sent: 0, failed: 0, invalidTokens: [] };
  if (input.caregiverIds.length === 0) return empty;

  try {
    const tokenRepo = new PushTokenRepository(db);
    const tokens = await tokenRepo.listForCaregivers(input.agencyId, input.caregiverIds);
    if (tokens.length === 0) return empty;

    // Resolve the owning users' preferences. Tenant-scoped through the
    // caregiver linkage the tokens already carry.
    const userIds = [...new Set(tokens.map((t) => t.userId))];
    const rows = (await db('users')
      .whereIn('id', userIds)
      .andWhere('agency_id', input.agencyId)
      .select('id', 'caregiver_id', 'notification_prefs')) as UserPrefRow[];

    const allowedUserIds = new Set(
      rows
        .filter((row) => {
          const prefs = parsePrefs(row.notification_prefs);
          return prefEnabled(prefs, input.category) && prefEnabled(prefs, 'channelPush');
        })
        .map((row) => row.id),
    );

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
    safeError('notifyCaregivers failed', err);
    return empty;
  }
}
