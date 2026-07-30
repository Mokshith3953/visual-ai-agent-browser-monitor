import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseBucket: process.env.SUPABASE_BUCKET ?? 'captures',

  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  visionModel: process.env.VISION_MODEL ?? 'claude-opus-4-8',

  workerPollMs: Number(process.env.WORKER_POLL_MS ?? 3000),
  workerBatch: Number(process.env.WORKER_BATCH ?? 4),
};
