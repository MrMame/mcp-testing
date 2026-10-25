#!/usr/bin/env node
import { parseConfig, USAGE } from './config.js';
import { log } from './log.js';
import { startHttpMcp } from './mcp/http.js';
import { startStdioMcp } from './mcp/stdio.js';
import { EventStore } from './monitor/eventStore.js';
import { Monitor } from './monitor/monitor.js';
import { startMonitorServer } from './monitor/monitorServer.js';

async function main(): Promise<void> {
  const config = parseConfig(process.argv.slice(2));
  if (config === 'help') {
    process.stderr.write(`${USAGE}\n`);
    return;
  }

  const store = new EventStore(config.dbPath);
  const monitor = new Monitor(store);

  const shutdown = () => {
    store.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  try {
    await startMonitorServer(monitor, config.monitorPort);
  } catch (err) {
    // Der MCP-Server soll auch ohne Oberfläche laufen, z. B. wenn der Port schon belegt ist.
    // Die Nachrichten werden trotzdem in SQLite geloggt.
    log.warn(`Monitoring-Oberfläche nicht gestartet (Port ${config.monitorPort})`, String(err));
  }

  if (config.transport === 'stdio') {
    await startStdioMcp(monitor, shutdown);
  } else {
    await startHttpMcp(monitor, config.mcpPort);
  }
}

main().catch((err) => {
  log.error('Start fehlgeschlagen', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
