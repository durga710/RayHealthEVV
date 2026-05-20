import type { Knex } from 'knex';

interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export class PasswordResetRepository {
  constructor(private db: Knex) {}

  async create(userId: string, tokenHash: string, expiresAt: string): Promise<void> {
    await this.db('password_reset_tokens').insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
  }

  async findValid(tokenHash: string): Promise<PasswordResetToken | null> {
    const row = await this.db('password_reset_tokens')
      .where('token_hash', tokenHash)
      .whereNull('used_at')
      .where('expires_at', '>', new Date().toISOString())
      .first();
    if (!row) return null;
    return {
      id: row.id as string,
      userId: row.user_id as string,
      tokenHash: row.token_hash as string,
      expiresAt: row.expires_at as string,
      usedAt: row.used_at as string | null,
      createdAt: row.created_at as string,
    };
  }

  async markUsed(id: string): Promise<void> {
    await this.db('password_reset_tokens')
      .where('id', id)
      .update({ used_at: new Date().toISOString() });
  }

  /** Deletes expired tokens older than the given age in ms. Called by housekeeping. */
  async deleteExpired(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    await this.db('password_reset_tokens')
      .where('expires_at', '<', cutoff)
      .delete();
  }
}
