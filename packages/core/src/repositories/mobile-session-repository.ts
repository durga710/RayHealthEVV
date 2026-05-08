import type { Knex } from 'knex';
import type { MobileSession, NewMobileSession } from '../domain/mobile-session.js';

type Row = {
  id: string;
  user_id: string;
  token_jti: string;
  device_label: string | null;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  created_at: Date | string;
};

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function map(row: Row): MobileSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenJti: row.token_jti,
    deviceLabel: row.device_label ?? undefined,
    expiresAt: iso(row.expires_at)!,
    revokedAt: iso(row.revoked_at),
    createdAt: iso(row.created_at)
  };
}

/**
 * Server-side bookkeeping for mobile JWT auth. Each issued JWT carries a
 * `jti` claim equal to `token_jti`; auth-context middleware rejects any
 * bearer token whose jti is absent here or whose row is revoked.
 */
export class MobileSessionRepository {
  constructor(private readonly db: Knex) {}

  async create(session: NewMobileSession): Promise<MobileSession> {
    const [row] = await this.db('mobile_sessions')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        user_id: session.userId,
        token_jti: session.tokenJti,
        device_label: session.deviceLabel ?? null,
        expires_at: session.expiresAt,
        revoked_at: null
      })
      .returning('*');
    return map(row);
  }

  async findActiveByJti(jti: string, nowIso: string): Promise<MobileSession | undefined> {
    const row = await this.db('mobile_sessions')
      .where({ token_jti: jti })
      .whereNull('revoked_at')
      .where('expires_at', '>', nowIso)
      .first();
    return row ? map(row) : undefined;
  }

  async revokeByJti(jti: string, revokedAtIso: string): Promise<void> {
    await this.db('mobile_sessions')
      .where({ token_jti: jti })
      .whereNull('revoked_at')
      .update({ revoked_at: revokedAtIso });
  }

  async revokeAllForUser(userId: string, revokedAtIso: string): Promise<void> {
    await this.db('mobile_sessions')
      .where({ user_id: userId })
      .whereNull('revoked_at')
      .update({ revoked_at: revokedAtIso });
  }
}
