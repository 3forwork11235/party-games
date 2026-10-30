import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GAMES } from './games.generated.js';
import { mountTelegram } from './telegram.js';

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? '0.0.0.0';

const app = express();
app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    games: GAMES.map((g) => g.slug),
    commit: process.env.RENDER_GIT_COMMIT ?? null,
  });
});

mountTelegram(app, {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  dataDir: resolve(process.env.DATA_DIR ?? 'data'),
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

for (const g of GAMES) {
  gameServer.define(g.slug, g.Room as never);
}

await gameServer.listen(port, host);
console.log(
  `[server] listening on ${host}:${port}, games: ${GAMES.map((g) => g.slug).join(', ') || '-'}`,
);

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[server] ${signal}, shutting down`);
  const timer = setTimeout(() => process.exit(1), 10_000);
  timer.unref();
  try {
    await gameServer.gracefullyShutdown(false);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
