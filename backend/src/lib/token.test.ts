import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from './token';

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    expect(hashToken('my-secret-token')).toBe(hashToken('my-secret-token'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });

  it('never returns the raw input', () => {
    const token = 'super-secret-value';
    expect(hashToken(token)).not.toContain(token);
  });

  it('returns a 64-char lowercase hex sha-256 digest', () => {
    const digest = hashToken('anything');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('generateToken', () => {
  it('generates unique tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it('generates URL-safe tokens (base64url, no padding)', () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
