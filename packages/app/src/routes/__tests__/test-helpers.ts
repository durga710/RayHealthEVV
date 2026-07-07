import jwt from 'jsonwebtoken';
import type { AppRole } from '@rayhealth/core';

const TEST_SECRET = 'test-secret-for-unit-tests';

export function setTestJwtSecret() {
  // Must be set before createApp() which validates JWT_SECRET at startup.
  process.env.JWT_SECRET = TEST_SECRET;
}

export function makeToken(
  role: AppRole,
  agencyId = 'agency-1',
  userId = 'user-1',
  caregiverId?: string
): string {
  // A `jti` is now mandatory on every bearer token (authContext rejects tokens
  // without one and looks the jti up against mobile_sessions). The shared test
  // setup stubs MobileSessionRepository.findActiveByJti to treat any jti as an
  // active session, so route tests keep passing without a live database.
  return jwt.sign({ sub: userId, agencyId, role, caregiverId }, TEST_SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256',
    jwtid: `test-jti-${userId}`,
  });
}
