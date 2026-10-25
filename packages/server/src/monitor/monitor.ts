import { EventEmitter } from 'node:events';
import type { Direction, MonitorEvent, SessionInfo, TransportKind } from '@mcp-testing/shared';
import { log } from '../log.js';
import { classify } from './classify.js';
import type { EventStore } from './eventStore.js';

interface MonitorEvents {
  event: [MonitorEvent];
  session: [SessionInfo];
}

/**
 * Zentrale Stelle, an der alle mitgeschnittenen Nachrichten ankommen.
 * Speichert sie und verteilt sie an Abonnenten (z. B. die WebSocket-Verbindungen der UI).
 */
export class Monitor extends EventEmitter<MonitorEvents> {
  readonly #store: EventStore;
  readonly #sessions = new Map<string, SessionInfo>();

  constructor(store: EventStore) {
    super();
    this.#store = store;
  }

  get store(): EventStore {
    return this.#store;
  }

  record(
    sessionId: string,
    transport: TransportKind,
    direction: Direction,
    message: unknown,
  ): void {
    try {
      const { kind, method, rpcId } = classify(message);
      this.#trackSession(sessionId, transport, method, message);
      const event = this.#store.insertEvent({
        sessionId,
        timestamp: Date.now(),
        direction,
        transport,
        kind,
        method,
        rpcId,
        payload: message,
      });
      this.emit('event', event);
    } catch (err) {
      // Monitoring darf den MCP-Verkehr nie unterbrechen.
      log.error('Monitor konnte Nachricht nicht aufzeichnen', String(err));
    }
  }

  endSession(sessionId: string): void {
    const session = this.#sessions.get(sessionId);
    if (!session || session.endedAt !== null) return;
    session.endedAt = Date.now();
    this.#publishSession(session);
  }

  #trackSession(
    sessionId: string,
    transport: TransportKind,
    method: string | null,
    message: unknown,
  ): void {
    let session = this.#sessions.get(sessionId);
    if (!session) {
      session = { sessionId, transport, startedAt: Date.now(), endedAt: null, clientInfo: null };
      this.#sessions.set(sessionId, session);
      this.#publishSession(session);
    }
    if (method === 'initialize') {
      const params = (message as { params?: { clientInfo?: SessionInfo['clientInfo'] } }).params;
      if (params?.clientInfo) {
        session.clientInfo = { name: params.clientInfo.name, version: params.clientInfo.version };
        this.#publishSession(session);
      }
    }
  }

  #publishSession(session: SessionInfo): void {
    this.#store.upsertSession(session);
    this.emit('session', { ...session });
  }
}
