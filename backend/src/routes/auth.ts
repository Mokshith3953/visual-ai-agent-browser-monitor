import type { FastifyInstance } from 'fastify';
import { supabase } from '../db/supabase.js';
import { generateToken, hashToken } from '../lib/auth.js';

/**
 * Minimal auth: register a user (optionally with email) and receive a bearer
 * token to paste into the extension's Settings. In production you'd layer real
 * auth (OAuth / magic link) on top; the token model stays the same.
 */
export function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: { email?: string } }>('/v1/auth/register', async (req, reply) => {
    const token = generateToken();
    const { data, error } = await supabase
      .from('app_users')
      .insert({ email: req.body?.email ?? null, token_hash: hashToken(token) })
      .select('id')
      .single();

    if (error) {
      req.log.error({ error }, 'register failed');
      return reply.code(500).send({ error: 'register_failed' });
    }
    // The raw token is returned exactly once, here.
    return reply.send({ userId: data.id, token });
  });
}
