import { describe, expect, it } from 'vitest';
import { hostOf, isExcluded, originOf } from './exclusion';

describe('originOf / hostOf', () => {
  it('extracts origin and host from a normal URL', () => {
    expect(originOf('https://mail.example.com/inbox?x=1')).toBe('https://mail.example.com');
    expect(hostOf('https://mail.example.com/inbox?x=1')).toBe('mail.example.com');
  });

  it('returns null for missing or unparseable input', () => {
    expect(originOf(null)).toBeNull();
    expect(originOf(undefined)).toBeNull();
    expect(originOf('not a url')).toBeNull();
    expect(hostOf('not a url')).toBeNull();
  });
});

describe('isExcluded', () => {
  const excluded = ['chrome://', 'chase.com', 'accounts.google.com'];

  it('excludes non-http(s) schemes outright', () => {
    expect(isExcluded('chrome://extensions', excluded)).toBe(true);
    expect(isExcluded('file:///etc/passwd', excluded)).toBe(true);
    expect(isExcluded('about:blank', excluded)).toBe(true);
  });

  it('excludes an exact domain match', () => {
    expect(isExcluded('https://chase.com/login', excluded)).toBe(true);
  });

  it('excludes subdomains of an excluded domain', () => {
    expect(isExcluded('https://secure.chase.com/login', excluded)).toBe(true);
  });

  it('does not exclude a domain that merely contains the excluded string', () => {
    // "notchase.com" must NOT match the "chase.com" rule (no accidental substring match)
    expect(isExcluded('https://notchase.com/', excluded)).toBe(false);
  });

  it('allows ordinary http(s) sites not on the list', () => {
    expect(isExcluded('https://github.com/anthropics', excluded)).toBe(false);
  });

  it('excludes null/undefined/unparseable URLs by default (fail closed)', () => {
    expect(isExcluded(null, excluded)).toBe(true);
    expect(isExcluded(undefined, excluded)).toBe(true);
    expect(isExcluded('not a url', excluded)).toBe(true);
  });

  it('supports scheme-prefix exclusion entries', () => {
    expect(isExcluded('chrome://settings', ['chrome://'])).toBe(true);
    expect(isExcluded('https://example.com', ['chrome://'])).toBe(false);
  });
});
