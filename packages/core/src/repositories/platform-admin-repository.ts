import type { Knex } from 'knex';

/**
 * Platform super-admin data access. The super-admin lives OUTSIDE the agency
 * tenancy model, so unlike every other repository these queries are
 * deliberately cross-agency. Only `superadmin-routes.ts` (behind
 * requirePlatformAdmin) may use this class.
 */

/** Fixed actor id for super-admin audit rows (super-admin has no users.id). */
export const SUPER_ADMIN_ACTOR_ID = '00000000-0000-0000-0000-0000000000ad';

export type AgencyReviewStatus = 'pending' | 'approved' | 'rejected';

export interface PlatformAgencyRow {
  id: string;
  name: string;
  state: string;
  reviewStatus: AgencyReviewStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  userCount: number;
  clientCount: number;
  adminEmails: string[];
}

export interface PlatformUserRow {
  id: string;
  email: string;
  role: string;
  agencyId: string;
  agencyName: string | null;
  createdAt: string | null;
  suspendedAt: string | null;
}

function toIso(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export class PlatformAdminRepository {
  constructor(private readonly db: Knex) {}

  /** Every agency, newest first, with signup metadata and roll-up counts. */
  async listAgencies(): Promise<PlatformAgencyRow[]> {
    const agencies = (await this.db('agencies')
      .select('*')
      .orderBy('created_at', 'desc')) as Array<Record<string, unknown>>;
    if (agencies.length === 0) return [];

    const ids = agencies.map((a) => a.id as string);
    const userCounts = (await this.db('users')
      .whereIn('agency_id', ids)
      .groupBy('agency_id')
      .select('agency_id')
      .count('id as c')) as Array<{ agency_id: string; c: string | number }>;
    const clientCounts = (await this.db('clients')
      .whereIn('agency_id', ids)
      .groupBy('agency_id')
      .select('agency_id')
      .count('id as c')) as Array<{ agency_id: string; c: string | number }>;
    const admins = (await this.db('users')
      .whereIn('agency_id', ids)
      .andWhere('role', 'admin')
      .select('agency_id', 'email')) as Array<{ agency_id: string; email: string }>;

    const userMap = new Map(userCounts.map((r) => [r.agency_id, Number(r.c)]));
    const clientMap = new Map(clientCounts.map((r) => [r.agency_id, Number(r.c)]));
    const adminMap = new Map<string, string[]>();
    for (const a of admins) {
      const list = adminMap.get(a.agency_id) ?? [];
      list.push(a.email);
      adminMap.set(a.agency_id, list);
    }

    return agencies.map((a) => {
      const id = a.id as string;
      return {
        id,
        name: a.name as string,
        state: (a.state as string) ?? '',
        reviewStatus: ((a.review_status as AgencyReviewStatus) ?? 'pending'),
        reviewedAt: toIso(a.reviewed_at),
        reviewedBy: (a.reviewed_by as string | null) ?? null,
        reviewNotes: (a.review_notes as string | null) ?? null,
        createdAt: toIso(a.created_at),
        userCount: userMap.get(id) ?? 0,
        clientCount: clientMap.get(id) ?? 0,
        adminEmails: adminMap.get(id) ?? [],
      };
    });
  }

  /**
   * Set an agency's review decision. Returns the updated row's id and name (for
   * the audit payload) or null if the agency doesn't exist.
   */
  async setAgencyReview(
    agencyId: string,
    status: AgencyReviewStatus,
    reviewedBy: string,
    notes: string | null,
  ): Promise<{ id: string; name: string } | null> {
    const n = await this.db('agencies')
      .where({ id: agencyId })
      .update({
        review_status: status,
        reviewed_at: this.db.fn.now(),
        reviewed_by: reviewedBy,
        review_notes: notes,
        updated_at: this.db.fn.now(),
      });
    if (n === 0) return null;
    const row = (await this.db('agencies').where({ id: agencyId }).first('id', 'name')) as
      | { id: string; name: string }
      | undefined;
    return row ?? null;
  }

  /** Every user across all agencies, newest first. */
  async listUsers(): Promise<PlatformUserRow[]> {
    const rows = (await this.db('users as u')
      .leftJoin('agencies as a', 'a.id', 'u.agency_id')
      .orderBy('u.created_at', 'desc')
      .select(
        'u.id',
        'u.email',
        'u.role',
        'u.agency_id',
        'u.created_at',
        'u.suspended_at',
        'a.name as agency_name',
      )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      email: r.email as string,
      role: r.role as string,
      agencyId: r.agency_id as string,
      agencyName: (r.agency_name as string | null) ?? null,
      createdAt: toIso(r.created_at),
      suspendedAt: toIso(r.suspended_at),
    }));
  }

  /**
   * Suspend (terminate) or reactivate a user account. Suspending also revokes
   * the user's active sessions so the lock-out is immediate. Returns the
   * affected user's agencyId + email for the audit row, or null if not found.
   */
  async setUserSuspended(
    userId: string,
    suspended: boolean,
  ): Promise<{ agencyId: string; email: string } | null> {
    const user = (await this.db('users').where({ id: userId }).first('agency_id', 'email')) as
      | { agency_id: string; email: string }
      | undefined;
    if (!user) return null;

    await this.db('users')
      .where({ id: userId })
      .update({ suspended_at: suspended ? this.db.fn.now() : null, updated_at: this.db.fn.now() });

    if (suspended) {
      await this.db('sessions')
        .where({ user_id: userId })
        .whereNull('revoked_at')
        .update({ revoked_at: this.db.fn.now() });
    }
    return { agencyId: user.agency_id, email: user.email };
  }
}
