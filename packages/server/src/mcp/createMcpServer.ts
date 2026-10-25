import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

export const SERVER_INFO = { name: 'mcp-testing', version: '0.1.0' } as const;

/**
 * Erzeugt eine MCP-Server-Instanz mit allen Tools, Resources und Prompts.
 * Pro Verbindung (stdio) bzw. Session (HTTP) wird eine eigene Instanz erzeugt.
 *
 * Die eigentliche Geschäftslogik wird später festgelegt; `echo` dient nur als Platzhalter,
 * um den Nachrichtenfluss im Monitor sichtbar zu machen.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(SERVER_INFO);

  server.registerTool(
    'echo',
    {
      title: 'Echo',
      description: 'Gibt den übergebenen Text unverändert zurück.',
      inputSchema: z.object({ text: z.string().describe('Zurückzugebender Text') }),
    },
    async ({ text }) => ({ content: [{ type: 'text', text }] }),
  );

  return server;
}
