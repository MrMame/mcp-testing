import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { TransportKind } from '@mcp-testing/shared';

export interface Config {
  transport: TransportKind;
  /** Port für den MCP-Endpunkt (nur Streamable HTTP). */
  mcpPort: number;
  /** Port der Monitoring-Oberfläche und ihrer API. */
  monitorPort: number;
  /** Pfad zur SQLite-Datei mit den Logs. */
  dbPath: string;
}

export const USAGE = `Aufruf: mcp-testing-server [Optionen]

  --transport <stdio|http>  MCP-Transport (Standard: stdio)
  --port <n>                Port des MCP-Endpunkts bei http (Standard: 3000)
  --monitor-port <n>        Port der Monitoring-Oberfläche (Standard: 3001)
  --db <pfad>               SQLite-Datei für Logs (Standard: data/monitor.db)
  -h, --help                Diese Hilfe anzeigen`;

function parsePort(value: string, name: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Ungültiger Wert für ${name}: ${value}`);
  }
  return port;
}

/** Liest die Konfiguration aus CLI-Argumenten, ersatzweise aus Umgebungsvariablen. */
export function parseConfig(argv: string[], env: NodeJS.ProcessEnv = process.env): Config | 'help' {
  const { values } = parseArgs({
    args: argv,
    options: {
      transport: { type: 'string' },
      port: { type: 'string' },
      'monitor-port': { type: 'string' },
      db: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });

  if (values.help) return 'help';

  const transport = values.transport ?? env.MCP_TRANSPORT ?? 'stdio';
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error(`Unbekannter Transport: ${transport}`);
  }

  return {
    transport,
    mcpPort: parsePort(values.port ?? env.MCP_PORT ?? '3000', '--port'),
    monitorPort: parsePort(values['monitor-port'] ?? env.MONITOR_PORT ?? '3001', '--monitor-port'),
    dbPath: resolve(values.db ?? env.MONITOR_DB ?? 'data/monitor.db'),
  };
}
