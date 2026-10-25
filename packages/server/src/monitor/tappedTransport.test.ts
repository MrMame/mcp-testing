import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';
import { createMcpServer } from '../mcp/createMcpServer.js';
import { EventStore } from './eventStore.js';
import { Monitor } from './monitor.js';
import { TappedTransport } from './tappedTransport.js';

describe('TappedTransport', () => {
  let store: EventStore;

  afterEach(() => store.close());

  it('zeichnet den Nachrichtenfluss eines Tool-Aufrufs in beide Richtungen auf', async () => {
    store = new EventStore(':memory:');
    const monitor = new Monitor(store);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

    await createMcpServer().connect(
      new TappedTransport(serverSide, monitor, { kind: 'stdio', fallbackSessionId: 'test' }),
    );
    const client = new Client({ name: 'vitest', version: '1.0.0' });
    await client.connect(clientSide);

    const result = await client.callTool({ name: 'echo', arguments: { text: 'hallo' } });
    expect(result.content).toEqual([{ type: 'text', text: 'hallo' }]);

    const events = store.queryEvents({ sessionId: 'test' });
    const summary = events.map((e) => `${e.direction} ${e.kind} ${e.method ?? ''}`.trim());
    expect(summary).toContain('client->server request initialize');
    expect(summary).toContain('server->client response');
    expect(summary).toContain('client->server notification notifications/initialized');
    expect(summary).toContain('client->server request tools/call');

    expect(store.listSessions()).toEqual([
      expect.objectContaining({
        sessionId: 'test',
        transport: 'stdio',
        clientInfo: { name: 'vitest', version: '1.0.0' },
      }),
    ]);

    await client.close();
  });
});
