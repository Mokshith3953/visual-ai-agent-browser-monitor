import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../db/supabase.js';
import { hashToken } from './token.js';

export { hashToken, generateToken } from './token.js';

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
