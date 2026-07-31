import type { FastifyBaseLogger } from 'fastify';
import { supabase } from '../db/supabase.js';
import { config } from '../config.js';
import { analyzeScreenshot } from './gemini.js';

/**
 * Async vision worker. Polls for `pending` captures, runs Gemini vision, and
 * writes the structured result back. Kept in-process for simplicity; in
 * production run it as its own service and scale it independently of ingestion.
 */
export function startVisionWorker(log: FastifyBaseLogger) {
  let running = false;

  async function tick() {
    if (running) return; // avoid overlapping ticks
    running = true;
    try {
      const { data: pending, error } = await supabase
        .from('captures')
        .select('id,user_id,url,title,image_path,text_only')
        .eq('status', 'pending')
        .order('occurred_at', { ascending: true })
        .limit(config.workerBatch);
      if (error) throw error;
      if (!pending?.length) return;

      for (const cap of pending) {
        await processOne(cap, log);
      }
    } catch (err) {
      log.error({ err }, 'vision worker tick failed');
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, config.workerPollMs);
  log.info({ pollMs: config.workerPollMs }, 'vision worker started');
  return () => clearInterval(timer);
}

interface PendingCapture {
  id: string;
  user_id: string;
  url: string | null;
  title: string | null;
  image_path: string | null;
  text_only: boolean;
}

async function processOne(cap: PendingCapture, log: FastifyBaseLogger) {
  if (!cap.image_path) {
    await supabase.from('captures').update({ status: 'skipped' }).eq('id', cap.id);
    return;
  }

  try {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(config.supabaseBucket)
      .download(cap.image_path);
    if (dlErr || !blob) throw dlErr ?? new Error('download_empty');

    const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
    const result = await analyzeScreenshot(base64, { url: cap.url, title: cap.title });

    await supabase
      .from('captures')
      .update({
        status: 'processed',
        app: result.app,
        task: result.task,
        category: result.category,
        entities: result.entities,
        summary: result.summary,
        contains_sensitive: result.containsSensitive,
        processed_at: new Date().toISOString(),
      })
      .eq('id', cap.id);

    // Privacy mode: drop the raw image now that we have the derived text.
    if (cap.text_only) {
      await supabase.storage.from(config.supabaseBucket).remove([cap.image_path]);
      await supabase.from('captures').update({ image_path: null }).eq('id', cap.id);
    }
  } catch (err) {
    log.error({ err, captureId: cap.id }, 'vision processing failed');
    await supabase.from('captures').update({ status: 'failed' }).eq('id', cap.id);
  }
}
