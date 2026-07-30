import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { supabase } from '../db/supabase.js';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';
import type { IncomingCapture } from '../types.js';

export function registerCaptureRoutes(app: FastifyInstance) {
  app.post<{ Body: IncomingCapture }>(
    '/v1/captures',
    {
      preHandler: requireAuth,
      // screenshots are ~50-300KB base64; allow generous body size
      bodyLimit: 8 * 1024 * 1024,
    },
    async (req, reply) => {
      const userId = req.userId!;
      const cap = req.body;
      if (!cap?.imageBase64) return reply.code(400).send({ error: 'missing_image' });

      const captureId = randomUUID();
      const imagePath = `${userId}/${captureId}.jpg`;
      const textOnly = Boolean(cap.textOnly);

      // Always upload so the async worker has an image to analyze. In text-only
      // (privacy) mode the worker deletes it again right after deriving text.
      const buffer = Buffer.from(cap.imageBase64, 'base64');
      const { error: upErr } = await supabase.storage
        .from(config.supabaseBucket)
        .upload(imagePath, buffer, { contentType: 'image/jpeg', upsert: false });
      if (upErr) {
        req.log.error({ upErr }, 'image upload failed');
        return reply.code(500).send({ error: 'upload_failed' });
      }

      const { error } = await supabase.from('captures').insert({
        id: captureId,
        user_id: userId,
        url: cap.url,
        title: cap.title,
        origin: cap.origin,
        phash: cap.phash,
        width: cap.width,
        height: cap.height,
        image_path: imagePath,
        text_only: textOnly,
        status: 'pending',
        occurred_at: new Date(cap.ts).toISOString(),
      });
      if (error) {
        req.log.error({ error }, 'insert capture failed');
        return reply.code(500).send({ error: 'insert_failed' });
      }

      // The vision worker picks this up asynchronously; ingestion stays fast.
      return reply.send({ id: captureId, status: 'pending' });
    },
  );
}
