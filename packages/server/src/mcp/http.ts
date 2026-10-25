import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { isInitializeRequest } from '@modelcontextprotocol/server';
import type { Request, Response } from 'express';
import { log } from '../log.js';
import type { Monitor } from '../monitor/monitor.js';
import { TappedTransport } from '../monitor/tappedTransport.js';
import { createMcpServer } from './createMcpServer.js';

/** Startet den MCP-Server als Streamable-HTTP-Endpunkt unter `/mcp` (zustandsbehaftet, mit Sessions). */
export function startHttpMcp(monitor: Monitor, port: number): Promise<Server> {
  const app = createMcpExpressApp();
  const transports = new Map<string, NodeStreamableHTTPServerTransport>();

  app.post('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.header('mcp-session-id');
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (sessionId || !isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Keine gültige Session-ID' },
          id: null,
        });
        return;
      }
      const created = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, created);
        },
      });
      transport = created;
      await createMcpServer().connect(
        new TappedTransport(created, monitor, {
          kind: 'http',
          fallbackSessionId: randomUUID(),
          onClosed: (id) => transports.delete(id),
        }),
      );
    }

    await transport.handleRequest(req, res, req.body);
  });

  // GET öffnet den SSE-Stream für Server-Nachrichten, DELETE beendet die Session.
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.header('mcp-session-id');
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send('Keine gültige Session-ID');
      return;
    }
    await transport.handleRequest(req, res);
  };
  app.get('/mcp', handleSessionRequest);
  app.delete('/mcp', handleSessionRequest);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address() as AddressInfo;
      log.info(`MCP-Server läuft auf http://127.0.0.1:${actual}/mcp`);
      resolve(server);
    });
    server.once('error', reject);
  });
}
