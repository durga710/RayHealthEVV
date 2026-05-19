import type { Knex } from 'knex';
import type { NewSession, Session } from '../domain/session.js';

type SessionRow = {
  id: string;
  agency_id: string;
  active_agency_id?: string | null;
  user_id: string;
  role: Session['role'];
  caregiver_id?: string | null;
  session_token_hash: string;
  csrf_token_hash: string;
  user_agent?: string | null;
  ip_address?: string | null;
  expires_at: Date | string;
  revoked_at?: Date | string | null;
  created_at?: Date | string;
};

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    agencyId: row.agency_id,
    activeAgencyId: row.active_agency_id ?? undefined,
    userId: row.user_id,
    role: row.role,
    caregiverId: row.caregiver_id ?? undefined,
    sessionTokenHash: row.session_token_hash,
    csrfTokenHash: row.csrf_token_hash,
    userAgent: row.user_agent ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    expiresAt: toIso(row.expires_at)!,
    revokedAt: toIso(row.revoked_at),
    createdAt: toIso(row.created_at)
  };
}

export class SessionRepository {
  constructor(private readonly db: Knex) {}

  async create(session: NewSession): Promise<Session> {
    const [row] = await this.db('sessions')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        agency_id: session.agencyId,
        user_id: session.userId,
        role: session.role,
        caregiver_id: session.caregiverId ?? null,
        session_token_hash: session.sessionTokenHash,
        csrf_token_hash: session.csrfTokenHash,
        user_agent: session.userAgent ?? null,
        ip_address: session.ipAddress ?? null,
        expires_at: session.expiresAt,
        revoked_at: null
      })
      .returning('*');
    return mapSession(row);
  }

  async findActiveByTokenHash(sessionTokenHash: string, nowIso: string): Promise<Session | undefined> {
    const row = await this.db('sessions')
      .where({ session_token_hash: sessionTokenHash })
      .whereNull('revoked_at')
      .where('expires_at', '>', nowIso)
      .first();
    return row ? mapSession(row) : undefined;
  }

  async revokeById(id: string, revokedAtIso: string): Promise<void> {
    await this.db('sessions')
      .where({ id })
      .whereNull('revoked_at')
      .update({ revoked_at: revokedAtIso });
  }

  async revokeByTokenHash(sessionTokenHash: string, revokedAtIso: string): Promise<void> {
    await this.db('sessions')
      .where({ session_token_hash: sessionTokenHash })
      .whereNull('revoked_at')
      .update({ revoked_at: revokedAtIso });
  }

  async rotateCsrfToken(id: string, csrfTokenHash: string): Promise<void> {
    await this.db('sessions')
      .where({ id })
      .whereNull('revoked_at')
      .update({ csrf_token_hash: csrfTokenHash });
  }

  async switchAgency(sessionId: string, agencyId: string): Promise<void> {
    await this.db('sessions')
      .where({ id: sessionId })
      .whereNull('revoked_at')
      .update({ active_agency_id: agencyId });
  }
}
