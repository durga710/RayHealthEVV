import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const requiredVercelEnv = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'CSRF_SECRET',
  'LOG_LEVEL',
  'CORS_ORIGIN',
  'BASE_URL',
  'APP_URL',
  'API_URL',
  'GOOGLE_CLIENT_ID',
  'VITE_GOOGLE_CLIENT_ID',
  'STRIPE_SECRET_KEY',
  'GOOGLE_IDENTITY_PLATFORM_PROJECT_ID',
  'OPENAI_API_KEY',
  'RAY_OPENAI_API_KEY',
  'RESEND_REPLY_TO',
  'RESEND_FROM_ADDRESS',
  'RESEND_API_KEY',
  'RAY_AI_PROVIDER',
  'GEMINI_API_KEY',
  'FIREBASE_API_KEY',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'AWS_BEARER_TOKEN_BEDROCK',
  'AWS_REGION',
  'DATABASE_URL',
] as const;

describe('turborepo environment configuration', () => {
  it('allowlists Vercel build environment variables used by deployed packages', () => {
    const turboConfig = JSON.parse(readFileSync(resolve(repoRoot, 'turbo.json'), 'utf8')) as {
      globalEnv?: string[];
    };

    expect(turboConfig.globalEnv).toEqual(expect.arrayContaining([...requiredVercelEnv]));
  });
});
