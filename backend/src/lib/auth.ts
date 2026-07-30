import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../db/supabase.js';

/** We store only the sha-256 of a token, never the token itself. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

/**
 * preHandler that authenticates the bearer token and attaches req.userId.
 * Rejects with 401 if the token is missing or unknown.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return reply.code(401).send({ error: 'missing_token' });

  const { data, error } = await supabase
    .from('app_users')
    .select('id')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (error) {
    req.log.error({ error }, 'auth lookup failed');
    return reply.code(500).send({ error: 'auth_lookup_failed' });
  }
  if (!data) return reply.code(401).send({ error: 'invalid_token' });

  req.userId = data.id;
}
