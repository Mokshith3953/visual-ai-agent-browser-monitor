import type { FastifyInstance } from 'fastify';
import { supabase } from '../db/supabase.js';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';

/** GDPR-style self-service: export everything, or delete everything. */
export function registerDataRoutes(app: FastifyInstance) {
  app.post('/v1/data/export', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.userId!;
    const [events, captures] = await Promise.all([
      supabase.from('activity_events').select('*').eq('user_id', userId),
      supabase.from('captures').select('*').eq('user_id', userId),
    ]);
    return reply
      .header('content-type', 'application/json')
      .send({
        exportedAt: new Date().toISOString(),
        events: events.data ?? [],
        captures: captures.data ?? [],
      });
  });

  app.post('/v1/data/delete', { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.userId!;

    // Remove stored screenshots first, then rows (cascade handles the rest).
    const { data: caps } = await supabase
      .from('captures')
      .select('image_path')
      .eq('user_id', userId)
      .not('image_path', 'is', null);
    const paths = (caps ?? []).map((c) => c.image_path).filter(Boolean) as string[];
    if (paths.length) {
      await supabase.storage.from(config.supabaseBucket).remove(paths);
    }

    await supabase.from('captures').delete().eq('user_id', userId);
    await supabase.from('activity_events').delete().eq('user_id', userId);
    await supabase.from('daily_summaries').delete().eq('user_id', userId);

    return reply.send({ deleted: true });
  });
}
