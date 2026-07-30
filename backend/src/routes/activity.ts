import type { FastifyInstance } from 'fastify';
import { supabase } from '../db/supabase.js';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';

/** Read APIs for the dashboard: recent captures + simple category rollups. */
export function registerActivityRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { limit?: string; since?: string } }>(
    '/v1/activity',
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = req.userId!;
      const limit = Math.min(200, Number(req.query.limit ?? 50));

      let q = supabase
        .from('captures')
        .select(
          'id,url,title,origin,app,task,category,entities,summary,status,image_path,occurred_at',
        )
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (req.query.since) q = q.gte('occurred_at', req.query.since);

      const { data, error } = await q;
      if (error) return reply.code(500).send({ error: 'query_failed' });

      // Sign image URLs on the fly (bucket is private).
      const items = await Promise.all(
        (data ?? []).map(async (row) => {
          let imageUrl: string | null = null;
          if (row.image_path) {
            const { data: signed } = await supabase.storage
              .from(config.supabaseBucket)
              .createSignedUrl(row.image_path, 60 * 10);
            imageUrl = signed?.signedUrl ?? null;
          }
          const { image_path, ...rest } = row;
          void image_path;
          return { ...rest, imageUrl };
        }),
      );

      return reply.send({ items });
    },
  );

  // Category totals over a window (defaults to today).
  app.get<{ Querystring: { since?: string } }>(
    '/v1/activity/summary',
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = req.userId!;
      const since = req.query.since ?? new Date().toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('captures')
        .select('category')
        .eq('user_id', userId)
        .eq('status', 'processed')
        .gte('occurred_at', since);
      if (error) return reply.code(500).send({ error: 'query_failed' });

      const totals: Record<string, number> = {};
      for (const row of data ?? []) {
        const c = row.category ?? 'other';
        totals[c] = (totals[c] ?? 0) + 1;
      }
      return reply.send({ since, totals });
    },
  );
}
