import jwt from 'jsonwebtoken';
import type { AppRole } from '@rayhealth/core';

const TEST_SECRET = 'test-secret-for-unit-tests';

export function setTestJwtSecret() {
  // Must be set before createApp() which validates JWT_SECRET at startup.
  process.env.JWT_SECRET = TEST_SECRET;
}

export function makeToken(role: AppRole, agencyId = 'agency-1', userId = 'user-1'): string {
  return jwt.sign({ sub: userId, agencyId, role }, TEST_SECRET, { expiresIn: '1h' });
}
