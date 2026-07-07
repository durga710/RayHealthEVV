import { describe, expect, it } from 'vitest';
import { isSafeOutboundUrl, isBlockedOutboundHost } from '../integrations/url-guard.js';

describe('isSafeOutboundUrl (SSRF guard, finding #11)', () => {
  it('accepts https URLs to public hosts', () => {
    expect(isSafeOutboundUrl('https://uat-api.sandata.example/altevv/v1/')).toBe(true);
    expect(isSafeOutboundUrl('https://sandbox.sandata.example/v1')).toBe(true);
  });

  it('rejects non-https schemes', () => {
    expect(isSafeOutboundUrl('http://api.sandata.example/v1')).toBe(false);
    expect(isSafeOutboundUrl('ftp://api.sandata.example')).toBe(false);
    expect(isSafeOutboundUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects the cloud metadata endpoint and link-local range', () => {
    expect(isSafeOutboundUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafeOutboundUrl('https://169.254.1.1/')).toBe(false);
  });

  it('rejects loopback and private ranges', () => {
    expect(isSafeOutboundUrl('https://127.0.0.1/')).toBe(false);
    expect(isSafeOutboundUrl('https://10.0.0.5/')).toBe(false);
    expect(isSafeOutboundUrl('https://172.16.4.4/')).toBe(false);
    expect(isSafeOutboundUrl('https://192.168.1.10/')).toBe(false);
    expect(isSafeOutboundUrl('https://localhost:8080/')).toBe(false);
    expect(isSafeOutboundUrl('https://svc.localhost/')).toBe(false);
  });

  it('rejects IPv6 loopback / link-local / unique-local', () => {
    expect(isSafeOutboundUrl('https://[::1]/')).toBe(false);
    expect(isSafeOutboundUrl('https://[fe80::1]/')).toBe(false);
    expect(isSafeOutboundUrl('https://[fc00::1]/')).toBe(false);
  });

  it('rejects unparseable input', () => {
    expect(isSafeOutboundUrl('not a url')).toBe(false);
    expect(isSafeOutboundUrl('')).toBe(false);
  });

  it('isBlockedOutboundHost flags the public 172.32/8 (outside private range) as allowed', () => {
    // 172.32.x is NOT in 172.16.0.0/12, must not be blocked.
    expect(isBlockedOutboundHost('172.32.0.1')).toBe(false);
    expect(isBlockedOutboundHost('8.8.8.8')).toBe(false);
  });
});
