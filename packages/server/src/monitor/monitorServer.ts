import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { ServerToUiMessage, UiToServerMessage } from '@mcp-testing/shared';
import { localhostHostValidation } from '@modelcontextprotocol/express';
import express from 'express';
import { WebSocketServer } from 'ws';
import { log } from '../log.js';
import type { Monitor } from './monitor.js';

const WEB_DIST = fileURLToPath(new URL('../../../web/dist', import.meta.url));
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * HTTP-Server für die Monitoring-Oberfläche:
 * - REST-API unter `/api` für den Log-Verlauf
 * - WebSocket unter `/ws` für Live-Events (und später Steuerbefehle)
 * - die gebaute Weboberfläche (packages/web/dist), falls vorhanden
 */
export function startMonitorServer(monitor: Monitor, port: number): Promise<Server> {
  const app = express();
  app.use(localhostHostValidation());

  app.get('/api/sessions', (_req, res) => {
    res.json(monitor.store.listSessions());
  });

  app.get('/api/events', (req, res) => {
    const q = req.query;
    res.json(
      monitor.store.queryEvents({
        sessionId: typeof q.sessionId === 'string' ? q.sessionId : undefined,
        method: typeof q.method === 'string' ? q.method : undefined,
        afterId: typeof q.afterId === 'string' ? Number(q.afterId) : undefined,
        limit: typeof q.limit === 'string' ? Number(q.limit) : undefined,
      }),
    );
  });

  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
  } else {
    app.get('/', (_req, res) => {
      res
        .type('text/plain')
        .send('Weboberfläche nicht gebaut. Entwicklung: npm run dev, dann http://localhost:5173');
    });
  }

  const server = createServer(app);
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    // Schutz gegen fremde Webseiten, die sich per WebSocket auf localhost verbinden.
    verifyClient: ({ origin }: { origin: string | undefined }) =>
      !origin || LOCAL_ORIGIN.test(origin),
  });

  const broadcast = (msg: ServerToUiMessage) => {
    const data = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(data);
    }
  };
  monitor.on('event', (event) => broadcast({ type: 'event', event }));
  monitor.on('session', (session) => broadcast({ type: 'session', session }));

  wss.on('connection', (socket) => {
    socket.on('message', (raw) => {
      let msg: UiToServerMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      // Steuerbefehle für die Geschäftslogik folgen, sobald ihr Umfang feststeht.
      log.debug('UI-Nachricht empfangen', msg);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address() as AddressInfo;
      log.info(`Monitoring-Oberfläche auf http://127.0.0.1:${actual}`);
      resolve(server);
    });
  });
}
