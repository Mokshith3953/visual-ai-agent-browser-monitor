import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerEventRoutes } from './routes/events.js';
import { registerCaptureRoutes } from './routes/captures.js';
import { registerActivityRoutes } from './routes/activity.js';
import { registerDataRoutes } from './routes/data.js';
import { startVisionWorker } from './vision/worker.js';

const app = Fastify({
  logger: true,
  bodyLimit: 8 * 1024 * 1024,
});

await app.register(cors, {
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  methods: ['GET', 'POST'],
});

app.get('/health', async () => ({ ok: true }));

registerAuthRoutes(app);
registerEventRoutes(app);
registerCaptureRoutes(app);
registerActivityRoutes(app);
registerDataRoutes(app);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  // Run the vision worker in the same process for simplicity. In production,
  // split it into its own process/container and scale independently.
  startVisionWorker(app.log);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
