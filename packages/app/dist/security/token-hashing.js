import crypto from 'node:crypto';
export function createOpaqueToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}
export function hashOpaqueToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
//# sourceMappingURL=token-hashing.js.map