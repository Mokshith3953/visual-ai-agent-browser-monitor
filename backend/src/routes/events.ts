import type { FastifyInstance } from 'fastify';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../lib/auth.js';
import type { IncomingEvent } from '../types.js';

export function registerEventRoutes(app: FastifyInstance) {
  app.post<{ Body: { events: IncomingEvent[] } }>(
    '/v1/events',
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = req.userId!;
      const events = req.body?.events ?? [];
      if (!Array.isArray(events) || events.length === 0) {
        return reply.send({ inserted: 0 });
      }

      const rows = events.slice(0, 200).map((e) => ({
        user_id: userId,
        kind: String(e.kind).slice(0, 40),
        url: e.url,
        title: e.title,
        origin: e.origin,
        tab_id: e.tabId,
        clicks: e.interactions?.clicks ?? null,
        scrolls: e.interactions?.scrolls ?? null,
        keypresses: e.interactions?.keypresses ?? null,
        active_ms: e.interactions?.activeMs ?? null,
        occurred_at: new Date(e.ts).toISOString(),
      }));

      const { error } = await supabase.from('activity_events').insert(rows);
      if (error) {
        req.log.error({ error }, 'insert events failed');
        return reply.code(500).send({ error: 'insert_failed' });
      }
      return reply.send({ inserted: rows.length });
    },
  );
}
