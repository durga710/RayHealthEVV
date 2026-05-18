import crypto from 'node:crypto';

export function createOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
