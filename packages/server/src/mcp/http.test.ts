import type { AddressInfo, Server } from 'node:net';
import type { MonitorEvent, ServerToUiMessage } from '@mcp-testing/shared';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { EventStore } from '../monitor/eventStore.js';
import { Monitor } from '../monitor/monitor.js';
import { startMonitorServer } from '../monitor/monitorServer.js';
import { startHttpMcp } from './http.js';

const portOf = (server: Server) => (server.address() as AddressInfo).port;

describe('Streamable HTTP + Monitor-Server', () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    for (const fn of cleanup.splice(0)) fn();
  });

  it('zeichnet HTTP-Sessions auf und liefert sie über API und WebSocket aus', async () => {
    const store = new EventStore(':memory:');
    const monitor = new Monitor(store);
    const mcpServer = await startHttpMcp(monitor, 0);
    const monitorServer = await startMonitorServer(monitor, 0);
    cleanup.push(
      () => mcpServer.close(),
      () => monitorServer.close(),
      () => store.close(),
    );
    const monitorUrl = `http://127.0.0.1:${portOf(monitorServer)}`;

    const ws = new WebSocket(`${monitorUrl.replace('http', 'ws')}/ws`);
    await new Promise((resolve) => ws.once('open', resolve));
    cleanup.unshift(() => ws.close());
    const live: ServerToUiMessage[] = [];
    ws.on('message', (data) => live.push(JSON.parse(String(data))));

    const client = new Client({ name: 'http-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${portOf(mcpServer)}/mcp`),
    );
    await client.connect(transport);
    await client.callTool({ name: 'echo', arguments: { text: 'über http' } });
    const sessionId = transport.sessionId;
    expect(sessionId).toBeTruthy();
    await client.close();

    const events = (await fetch(`${monitorUrl}/api/events?sessionId=${sessionId}`).then((r) =>
      r.json(),
    )) as MonitorEvent[];
    expect(events.some((e) => e.method === 'tools/call')).toBe(true);
    expect(events.every((e) => e.transport === 'http')).toBe(true);

    await expect.poll(() => live.some((m) => m.type === 'event')).toBe(true);
    expect(live.some((m) => m.type === 'session' && m.session.sessionId === sessionId)).toBe(true);
  });
});
