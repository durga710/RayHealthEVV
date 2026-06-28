/**
 * Platform super-admin data access. The super-admin lives OUTSIDE the agency
 * tenancy model, so unlike every other repository these queries are
 * deliberately cross-agency. Only `superadmin-routes.ts` (behind
 * requirePlatformAdmin) may use this class.
 */
/** Fixed actor id for super-admin audit rows (super-admin has no users.id). */
export const SUPER_ADMIN_ACTOR_ID = '00000000-0000-0000-0000-0000000000ad';
function toIso(v) {
    if (v == null)
        return null;
    return v instanceof Date ? v.toISOString() : String(v);
}
export class PlatformAdminRepository {
    constructor(db) {
        this.db = db;
    }
    /** Every agency, newest first, with signup metadata and roll-up counts. */
    async listAgencies() {
        const agencies = (await this.db('agencies')
            .select('*')
            .orderBy('created_at', 'desc'));
        if (agencies.length === 0)
            return [];
        const ids = agencies.map((a) => a.id);
        const userCounts = (await this.db('users')
            .whereIn('agency_id', ids)
            .groupBy('agency_id')
            .select('agency_id')
            .count('id as c'));
        const clientCounts = (await this.db('clients')
            .whereIn('agency_id', ids)
            .groupBy('agency_id')
            .select('agency_id')
            .count('id as c'));
        const admins = (await this.db('users')
            .whereIn('agency_id', ids)
            .andWhere('role', 'admin')
            .select('agency_id', 'email'));
        const userMap = new Map(userCounts.map((r) => [r.agency_id, Number(r.c)]));
        const clientMap = new Map(clientCounts.map((r) => [r.agency_id, Number(r.c)]));
        const adminMap = new Map();
        for (const a of admins) {
            const list = adminMap.get(a.agency_id) ?? [];
            list.push(a.email);
            adminMap.set(a.agency_id, list);
        }
        return agencies.map((a) => {
            const id = a.id;
            return {
                id,
                name: a.name,
                state: a.state ?? '',
                reviewStatus: (a.review_status ?? 'pending'),
                reviewedAt: toIso(a.reviewed_at),
                reviewedBy: a.reviewed_by ?? null,
                reviewNotes: a.review_notes ?? null,
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
    async setAgencyReview(agencyId, status, reviewedBy, notes) {
        const n = await this.db('agencies')
            .where({ id: agencyId })
            .update({
            review_status: status,
            reviewed_at: this.db.fn.now(),
            reviewed_by: reviewedBy,
            review_notes: notes,
            updated_at: this.db.fn.now(),
        });
        if (n === 0)
            return null;
        const row = (await this.db('agencies').where({ id: agencyId }).first('id', 'name'));
        return row ?? null;
    }
    /** Every user across all agencies, newest first. */
    async listUsers() {
        const rows = (await this.db('users as u')
            .leftJoin('agencies as a', 'a.id', 'u.agency_id')
            .orderBy('u.created_at', 'desc')
            .select('u.id', 'u.email', 'u.role', 'u.agency_id', 'u.created_at', 'u.suspended_at', 'a.name as agency_name'));
        return rows.map((r) => ({
            id: r.id,
            email: r.email,
            role: r.role,
            agencyId: r.agency_id,
            agencyName: r.agency_name ?? null,
            createdAt: toIso(r.created_at),
            suspendedAt: toIso(r.suspended_at),
        }));
    }
    /**
     * Suspend (terminate) or reactivate a user account. Suspending also revokes
     * the user's active sessions so the lock-out is immediate. Returns the
     * affected user's agencyId + email for the audit row, or null if not found.
     */
    async setUserSuspended(userId, suspended) {
        const user = (await this.db('users').where({ id: userId }).first('agency_id', 'email'));
        if (!user)
            return null;
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
    async getPlatformStats() {
        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
        const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
        const safe = async (fn, fallback) => {
            try {
                return await fn();
            }
            catch {
                return fallback;
            }
        };
        const num = (v) => Number(v ?? 0) || 0;
        const [agencyRows, userRows, suspended, clients, cgRows, visitRows, openExc, claimRows] = await Promise.all([
            safe(() => this.db('agencies').select('review_status').count('id as c').groupBy('review_status'), []),
            safe(() => this.db('users').select('role').count('id as c').groupBy('role'), []),
            safe(async () => num((await this.db('users').whereNotNull('suspended_at').count('id as c'))[0]?.c), 0),
            safe(async () => num((await this.db('clients').count('id as c'))[0]?.c), 0),
            safe(() => this.db('caregivers').select('status').count('id as c').groupBy('status'), []),
            safe(async () => ({
                total: num((await this.db('evv_visits').count('id as c'))[0]?.c),
                today: num((await this.db('evv_visits').where('clock_in_time', '>=', todayStart).count('id as c'))[0]?.c),
                last7d: num((await this.db('evv_visits').where('clock_in_time', '>=', weekAgo).count('id as c'))[0]?.c),
                verified: num((await this.db('evv_visits').where('status', 'verified').count('id as c'))[0]?.c),
            }), { total: 0, today: 0, last7d: 0, verified: 0 }),
            safe(async () => num((await this.db('evv_exceptions').whereNull('approved_at').count('id as c'))[0]?.c), 0),
            safe(() => this.db('claims').select('status').count('id as c')
                .sum('total_charge_cents as charged').groupBy('status'), []),
        ]);
        const agencyByStatus = agencyRows;
        const get = (rows, key, val) => num(rows.find((r) => r[key] === val)?.c);
        const byRole = {};
        let userTotal = 0;
        for (const r of userRows) {
            byRole[r.role] = num(r.c);
            userTotal += num(r.c);
        }
        const cg = cgRows;
        const cgTotal = cg.reduce((s, r) => s + num(r.c), 0);
        const claimByStatus = {};
        let claimTotal = 0;
        let chargedCents = 0;
        for (const r of claimRows) {
            claimByStatus[r.status] = num(r.c);
            claimTotal += num(r.c);
            chargedCents += num(r.charged);
        }
        const paidCents = await safe(async () => num((await this.db('claims').sum('paid_cents as p'))[0]?.p), 0);
        return {
            agencies: {
                total: agencyByStatus.reduce((s, r) => s + num(r.c), 0),
                pending: get(agencyByStatus, 'review_status', 'pending'),
                approved: get(agencyByStatus, 'review_status', 'approved'),
                rejected: get(agencyByStatus, 'review_status', 'rejected'),
            },
            users: { total: userTotal, suspended, byRole },
            clients,
            caregivers: { total: cgTotal, active: get(cg, 'status', 'active') },
            visits: visitRows,
            exceptions: { open: openExc },
            claims: { total: claimTotal, byStatus: claimByStatus, chargedCents, paidCents },
            generatedAt: now.toISOString(),
        };
    }
    /** Global, cross-agency audit feed — newest first. The "monitor everything" tap. */
    async getRecentActivity(limit = 40) {
        const rows = (await this.db('audit_events as e')
            .leftJoin('agencies as a', 'a.id', 'e.agency_id')
            .orderBy('e.occurred_at', 'desc')
            .limit(Math.min(Math.max(limit, 1), 200))
            .select('e.id', 'e.event_type', 'e.entity_type', 'e.actor_type', 'e.outcome', 'e.agency_id', 'e.occurred_at', 'a.name as agency_name'));
        return rows.map((r) => ({
            id: r.id,
            eventType: r.event_type,
            entityType: r.entity_type,
            actorType: r.actor_type,
            outcome: r.outcome,
            agencyId: r.agency_id,
            agencyName: r.agency_name ?? null,
            occurredAt: toIso(r.occurred_at),
        }));
    }
    /** Deep drill-down on one agency — counts, its users, and its recent activity. */
    async getAgencyDetail(agencyId) {
        const base = (await this.listAgencies()).find((a) => a.id === agencyId);
        if (!base)
            return null;
        const num = (v) => Number(v ?? 0) || 0;
        const safe = async (fn, fallback) => {
            try {
                return await fn();
            }
            catch {
                return fallback;
            }
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
                .select('u.id', 'u.email', 'u.role', 'u.agency_id', 'u.created_at', 'u.suspended_at', 'a.name as agency_name'), []),
            safe(() => this.db('audit_events as e')
                .leftJoin('agencies as a', 'a.id', 'e.agency_id')
                .where('e.agency_id', agencyId)
                .orderBy('e.occurred_at', 'desc')
                .limit(25)
                .select('e.id', 'e.event_type', 'e.entity_type', 'e.actor_type', 'e.outcome', 'e.agency_id', 'e.occurred_at', 'a.name as agency_name'), []),
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
            users: users.map((r) => ({
                id: r.id,
                email: r.email,
                role: r.role,
                agencyId: r.agency_id,
                agencyName: r.agency_name ?? null,
                createdAt: toIso(r.created_at),
                suspendedAt: toIso(r.suspended_at),
            })),
            recentActivity: activity.map((r) => ({
                id: r.id,
                eventType: r.event_type,
                entityType: r.entity_type,
                actorType: r.actor_type,
                outcome: r.outcome,
                agencyId: r.agency_id,
                agencyName: r.agency_name ?? null,
                occurredAt: toIso(r.occurred_at),
            })),
        };
    }
}
//# sourceMappingURL=platform-admin-repository.js.map