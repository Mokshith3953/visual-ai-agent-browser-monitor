import { createHash, randomBytes } from 'node:crypto';

/** We store only the sha-256 of a bearer token, never the token itself. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}
