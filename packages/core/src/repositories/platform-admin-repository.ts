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

export interface PlatformStats {
  agencies: { total: number; pending: number; approved: number; rejected: number };
  users: { total: number; suspended: number; byRole: Record<string, number> };
  clients: number;
  caregivers: { total: number; active: number };
  visits: { total: number; today: number; last7d: number; verified: number };
  exceptions: { open: number };
  claims: { total: number; byStatus: Record<string, number>; chargedCents: number; paidCents: number };
  generatedAt: string;
}

export interface PlatformActivityRow {
  id: string;
  eventType: string;
  entityType: string;
  actorType: string;
  outcome: string;
  agencyId: string;
  agencyName: string | null;
  occurredAt: string | null;
}

export interface PlatformAgencyDetail extends PlatformAgencyRow {
  caregiverCount: number;
  visitCount: number;
  claimCount: number;
  chargedCents: number;
  users: PlatformUserRow[];
  recentActivity: PlatformActivityRow[];
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

  /**
   * Cross-agency platform metrics for the CEO command center. Every aggregate is
   * wrapped so a missing table/column degrades that one number to 0 rather than
   * failing the whole dashboard.
   */
  async getPlatformStats(): Promise<PlatformStats> {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch {
        return fallback;
      }
    };
    const num = (v: unknown): number => Number(v ?? 0) || 0;

    const [agencyRows, userRows, suspended, clients, cgRows, visitRows, openExc, claimRows] = await Promise.all([
      safe(() => this.db('agencies').select('review_status').count('id as c').groupBy('review_status'), [] as any[]),
      safe(() => this.db('users').select('role').count('id as c').groupBy('role'), [] as any[]),
      safe(async () => num((await this.db('users').whereNotNull('suspended_at').count('id as c'))[0]?.c), 0),
      safe(async () => num((await this.db('clients').count('id as c'))[0]?.c), 0),
      safe(() => this.db('caregivers').select('status').count('id as c').groupBy('status'), [] as any[]),
      safe(async () => ({
        total: num((await this.db('evv_visits').count('id as c'))[0]?.c),
        today: num((await this.db('evv_visits').where('clock_in_time', '>=', todayStart).count('id as c'))[0]?.c),
        last7d: num((await this.db('evv_visits').where('clock_in_time', '>=', weekAgo).count('id as c'))[0]?.c),
        verified: num((await this.db('evv_visits').where('status', 'verified').count('id as c'))[0]?.c),
      }), { total: 0, today: 0, last7d: 0, verified: 0 }),
      safe(async () => num((await this.db('evv_exceptions').whereNull('approved_at').count('id as c'))[0]?.c), 0),
      safe(() => this.db('claims').select('status').count('id as c')
        .sum('total_charge_cents as charged').groupBy('status'), [] as any[]),
    ]);

    const agencyByStatus = (agencyRows as Array<{ review_status: string; c: unknown }>);
    const get = (rows: Array<Record<string, unknown>>, key: string, val: string): number =>
      num(rows.find((r) => r[key] === val)?.c);

    const byRole: Record<string, number> = {};
    let userTotal = 0;
    for (const r of userRows as Array<{ role: string; c: unknown }>) {
      byRole[r.role] = num(r.c);
      userTotal += num(r.c);
    }

    const cg = cgRows as Array<{ status: string; c: unknown }>;
    const cgTotal = cg.reduce((s, r) => s + num(r.c), 0);

    const claimByStatus: Record<string, number> = {};
    let claimTotal = 0;
    let chargedCents = 0;
    for (const r of claimRows as Array<{ status: string; c: unknown; charged: unknown }>) {
      claimByStatus[r.status] = num(r.c);
      claimTotal += num(r.c);
      chargedCents += num(r.charged);
    }
    const paidCents = await safe(async () => num((await this.db('claims').sum('paid_cents as p'))[0]?.p), 0);

    return {
      agencies: {
        total: agencyByStatus.reduce((s, r) => s + num(r.c), 0),
        pending: get(agencyByStatus as any, 'review_status', 'pending'),
        approved: get(agencyByStatus as any, 'review_status', 'approved'),
        rejected: get(agencyByStatus as any, 'review_status', 'rejected'),
      },
      users: { total: userTotal, suspended, byRole },
      clients,
      caregivers: { total: cgTotal, active: get(cg as any, 'status', 'active') },
      visits: visitRows,
      exceptions: { open: openExc },
      claims: { total: claimTotal, byStatus: claimByStatus, chargedCents, paidCents },
      generatedAt: now.toISOString(),
    };
  }

  /** Global, cross-agency audit feed, newest first. The "monitor everything" tap. */
  async getRecentActivity(limit = 40): Promise<PlatformActivityRow[]> {
    const rows = (await this.db('audit_events as e')
      .leftJoin('agencies as a', 'a.id', 'e.agency_id')
      .orderBy('e.occurred_at', 'desc')
      .limit(Math.min(Math.max(limit, 1), 200))
      .select(
        'e.id',
        'e.event_type',
        'e.entity_type',
        'e.actor_type',
        'e.outcome',
        'e.agency_id',
        'e.occurred_at',
        'a.name as agency_name',
      )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      eventType: r.event_type as string,
      entityType: r.entity_type as string,
      actorType: r.actor_type as string,
      outcome: r.outcome as string,
      agencyId: r.agency_id as string,
      agencyName: (r.agency_name as string | null) ?? null,
      occurredAt: toIso(r.occurred_at),
    }));
  }

  /** Deep drill-down on one agency, counts, its users, and its recent activity. */
  async getAgencyDetail(agencyId: string): Promise<PlatformAgencyDetail | null> {
    const base = (await this.listAgencies()).find((a) => a.id === agencyId);
    if (!base) return null;
    const num = (v: unknown): number => Number(v ?? 0) || 0;
    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); } catch { return fallback; }
    };

    const [caregiverCount, claimAgg, users, activity] = await Promise.all([
      safe(async () => num((await this.db('caregivers').where('agency_id', agencyId).count('id as c'))[0]?.c), 0),
      safe(async () => {
        const [row] = await this.db('claims').where('agency_id', agencyId)
          .count('id as c').sum('total_charge_cents as charged');
        return { count: num(row?.c), charged: num(row?.charged) };
      }, { count: 0, charged: 0 }),
      safe(() => this.db('users as u')
        .leftJoin('agencies as a', 'a.id', 'u.agency_id')
        .where('u.agency_id', agencyId)
        .orderBy('u.created_at', 'desc')
        .select('u.id', 'u.email', 'u.role', 'u.agency_id', 'u.created_at', 'u.suspended_at', 'a.name as agency_name'),
        [] as Array<Record<string, unknown>>),
      safe(() => this.db('audit_events as e')
        .leftJoin('agencies as a', 'a.id', 'e.agency_id')
        .where('e.agency_id', agencyId)
        .orderBy('e.occurred_at', 'desc')
        .limit(25)
        .select('e.id', 'e.event_type', 'e.entity_type', 'e.actor_type', 'e.outcome', 'e.agency_id', 'e.occurred_at', 'a.name as agency_name'),
        [] as Array<Record<string, unknown>>),
    ]);

    // evv_visits has no agency_id; count via the caregiver → users → agency join.
    const visitCount = await safe(async () => num((await this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .countDistinct('v.id as c'))[0]?.c), 0);

    return {
      ...base,
      caregiverCount,
      visitCount,
      claimCount: claimAgg.count,
      chargedCents: claimAgg.charged,
      users: (users as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        email: r.email as string,
        role: r.role as string,
        agencyId: r.agency_id as string,
        agencyName: (r.agency_name as string | null) ?? null,
        createdAt: toIso(r.created_at),
        suspendedAt: toIso(r.suspended_at),
      })),
      recentActivity: (activity as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        eventType: r.event_type as string,
        entityType: r.entity_type as string,
        actorType: r.actor_type as string,
        outcome: r.outcome as string,
        agencyId: r.agency_id as string,
        agencyName: (r.agency_name as string | null) ?? null,
        occurredAt: toIso(r.occurred_at),
      })),
    };
  }
}
