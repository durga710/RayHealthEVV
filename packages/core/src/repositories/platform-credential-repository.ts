import type { Knex } from 'knex';

/**
 * WebAuthn (passkey) credentials for the platform super-admin's second factor.
 * Stores only the public key + signature counter — never biometric data. Keyed
 * by `username` (the env SUPER_ADMIN_USERNAME) because the super-admin is not a
 * `users` row.
 */

export interface PlatformCredential {
  id: string;
  username: string;
  credentialId: string; // base64url
  publicKey: string; // base64url-encoded COSE key
  counter: number;
  transports: string[];
  deviceLabel: string | null;
}

interface NewPlatformCredential {
  username: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceLabel?: string | null;
}

function mapRow(r: Record<string, unknown>): PlatformCredential {
  let transports: string[] = [];
  if (typeof r.transports === 'string' && r.transports) {
    try {
      transports = JSON.parse(r.transports) as string[];
    } catch {
      transports = [];
    }
  } else if (Array.isArray(r.transports)) {
    transports = r.transports as string[];
  }
  return {
    id: r.id as string,
    username: r.username as string,
    credentialId: r.credential_id as string,
    publicKey: r.public_key as string,
    counter: Number(r.counter ?? 0),
    transports,
    deviceLabel: (r.device_label as string | null) ?? null,
  };
}

export class PlatformCredentialRepository {
  constructor(private readonly db: Knex) {}

  async countByUsername(username: string): Promise<number> {
    const [{ c }] = await this.db('platform_admin_credentials')
      .where({ username })
      .count('id as c');
    return Number(c);
  }

  async listByUsername(username: string): Promise<PlatformCredential[]> {
    const rows = (await this.db('platform_admin_credentials')
      .where({ username })
      .orderBy('created_at', 'asc')) as Array<Record<string, unknown>>;
    return rows.map(mapRow);
  }

  async findByCredentialId(credentialId: string): Promise<PlatformCredential | undefined> {
    const row = (await this.db('platform_admin_credentials')
      .where({ credential_id: credentialId })
      .first()) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  }

  async add(input: NewPlatformCredential): Promise<{ id: string }> {
    const [row] = await this.db('platform_admin_credentials')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        username: input.username,
        credential_id: input.credentialId,
        public_key: input.publicKey,
        counter: input.counter,
        transports: JSON.stringify(input.transports ?? []),
        device_label: input.deviceLabel ?? null,
      })
      .returning('id');
    return { id: row.id as string };
  }

  async updateCounter(credentialId: string, counter: number): Promise<void> {
    await this.db('platform_admin_credentials')
      .where({ credential_id: credentialId })
      .update({ counter, last_used_at: this.db.fn.now() });
  }

  async remove(id: string, username: string): Promise<boolean> {
    const n = await this.db('platform_admin_credentials').where({ id, username }).del();
    return n > 0;
  }
}
