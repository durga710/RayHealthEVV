import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';

/**
 * Cell-level (column-level) symmetric encryption for sensitive PHI fields.
 *
 * Scope: medicaid_number, npi, and any future column that should be opaque
 * to anyone with raw DB access. Application-side AES-256-GCM ensures a
 * stolen backup or read-replica leak does not surface plaintext PHI; the
 * ENCRYPTION_KEY lives only in deploy provider env (Vercel) and never on
 * the DB host.
 *
 * Output format (single string):
 *   `v1:` envelope prefix (so a future v2: format can coexist for rotation)
 *   + base64( 12-byte IV || 16-byte auth tag || ciphertext )
 *
 * Key sourcing:
 *   - ENCRYPTION_KEY env var. Accepts either a 64-char hex string (32 bytes)
 *     or any string ≥ 32 chars; in the second case we SHA-256 it down to
 *     32 bytes so operators cannot accidentally use a too-short key.
 *
 * Operational notes:
 *   - Decrypting a blob without the matching key throws; the repository
 *     surfaces a clear error rather than returning corrupted plaintext.
 *   - During rollout, columns may still hold legacy plaintext. `decryptCell`
 *     returns those round-trip so reads keep working until backfill runs.
 */

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

// Node's Buffer is a Uint8Array subclass at runtime; @types/node 22+ widened
// Buffer's generic to ArrayBufferLike which TS no longer auto-narrows to the
// ArrayBuffer expected by createCipheriv/createDecipheriv. The cast is safe
// because every Buffer here is backed by a real ArrayBuffer (not Shared).
const bytes = (b: Buffer | Uint8Array): Uint8Array => b as unknown as Uint8Array;

function loadKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY env var is required for PHI column encryption. ' +
        'Set a 64-char hex string (32 bytes) or any string ≥ 32 chars.'
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  if (raw.length >= 32) return createHash('sha256').update(raw).digest();
  throw new Error('ENCRYPTION_KEY must be 64-char hex OR ≥ 32 chars.');
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

export function encryptCell(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, bytes(key()), bytes(iv));
  const ct = Buffer.concat([bytes(cipher.update(plain, 'utf8')), bytes(cipher.final())]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([bytes(iv), bytes(tag), bytes(ct)]).toString('base64')}`;
}

export function decryptCell(blob: string | null | undefined): string | null | undefined {
  if (blob == null || blob === '') return blob ?? null;
  if (!blob.startsWith(`${VERSION}:`)) {
    // Legacy plaintext during rollout — return as-is. Backfill tooling later.
    return blob;
  }
  const buf = Buffer.from(blob.slice(VERSION.length + 1), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, bytes(key()), bytes(iv));
  decipher.setAuthTag(bytes(tag));
  const pt = Buffer.concat([bytes(decipher.update(bytes(ct))), bytes(decipher.final())]);
  return pt.toString('utf8');
}
