import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { log } from '../log.js';
import type { Monitor } from '../monitor/monitor.js';
import { TappedTransport } from '../monitor/tappedTransport.js';
import { createMcpServer } from './createMcpServer.js';

/** Startet den MCP-Server auf stdin/stdout. `onEnd` wird gerufen, wenn der Client die Verbindung schließt. */
export async function startStdioMcp(monitor: Monitor, onEnd: () => void): Promise<void> {
  const server = createMcpServer();
  const transport = new TappedTransport(new StdioServerTransport(), monitor, {
    kind: 'stdio',
    fallbackSessionId: randomUUID(),
    onClosed: onEnd,
  });
  // Ohne diesen Hook liefe der Prozess nach Client-Ende wegen des Monitor-Servers weiter.
  process.stdin.once('end', onEnd);
  await server.connect(transport);
  log.info('MCP-Server läuft auf stdio');
}
