import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { MonitorEvent, SessionInfo } from '@mcp-testing/shared';

export interface EventQuery {
  sessionId?: string;
  method?: string;
  /** Nur Events mit größerer ID (zum Nachladen). */
  afterId?: number;
  limit?: number;
}

interface EventRow {
  id: number;
  session_id: string;
  ts: number;
  direction: MonitorEvent['direction'];
  transport: MonitorEvent['transport'];
  kind: MonitorEvent['kind'];
  method: string | null;
  rpc_id: string | null;
  payload: string;
}

interface SessionRow {
  session_id: string;
  transport: SessionInfo['transport'];
  started_at: number;
  ended_at: number | null;
  client_info: string | null;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    session_id  TEXT PRIMARY KEY,
    transport   TEXT NOT NULL,
    started_at  INTEGER NOT NULL,
    ended_at    INTEGER,
    client_info TEXT
  );
  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    ts         INTEGER NOT NULL,
    direction  TEXT NOT NULL,
    transport  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    method     TEXT,
    rpc_id     TEXT,
    payload    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, id);
  CREATE INDEX IF NOT EXISTS idx_events_method ON events(method);
`;

/** Persistiert mitgeschnittene Nachrichten und Sitzungen in SQLite. */
export class EventStore {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    this.#db.exec('PRAGMA journal_mode = WAL;');
    this.#db.exec(SCHEMA);
  }

  insertEvent(event: Omit<MonitorEvent, 'id'>): MonitorEvent {
    const result = this.#db
      .prepare(
        `INSERT INTO events (session_id, ts, direction, transport, kind, method, rpc_id, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.sessionId,
        event.timestamp,
        event.direction,
        event.transport,
        event.kind,
        event.method,
        event.rpcId === null ? null : JSON.stringify(event.rpcId),
        JSON.stringify(event.payload),
      );
    return { ...event, id: Number(result.lastInsertRowid) };
  }

  queryEvents(query: EventQuery = {}): MonitorEvent[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (query.sessionId) {
      where.push('session_id = ?');
      params.push(query.sessionId);
    }
    if (query.method) {
      where.push('method = ?');
      params.push(query.method);
    }
    if (query.afterId !== undefined) {
      where.push('id > ?');
      params.push(query.afterId);
    }
    const limit = Math.min(Math.max(query.limit ?? 500, 1), 5000);
    // Die neuesten N Events holen, aber chronologisch zurückgeben.
    const sql = `SELECT * FROM (
        SELECT * FROM events ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY id DESC LIMIT ?
      ) ORDER BY id ASC`;
    const rows = this.#db.prepare(sql).all(...params, limit) as unknown as EventRow[];
    return rows.map(toEvent);
  }

  upsertSession(session: SessionInfo): void {
    this.#db
      .prepare(
        `INSERT INTO sessions (session_id, transport, started_at, ended_at, client_info)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           ended_at = excluded.ended_at,
           client_info = COALESCE(excluded.client_info, sessions.client_info)`,
      )
      .run(
        session.sessionId,
        session.transport,
        session.startedAt,
        session.endedAt,
        session.clientInfo ? JSON.stringify(session.clientInfo) : null,
      );
  }

  listSessions(limit = 100): SessionInfo[] {
    const rows = this.#db
      .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?')
      .all(limit) as unknown as SessionRow[];
    return rows.map((r) => ({
      sessionId: r.session_id,
      transport: r.transport,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      clientInfo: r.client_info ? JSON.parse(r.client_info) : null,
    }));
  }

  close(): void {
    this.#db.close();
  }
}

function toEvent(r: EventRow): MonitorEvent {
  return {
    id: r.id,
    sessionId: r.session_id,
    timestamp: r.ts,
    direction: r.direction,
    transport: r.transport,
    kind: r.kind,
    method: r.method,
    rpcId: r.rpc_id === null ? null : JSON.parse(r.rpc_id),
    payload: JSON.parse(r.payload),
  };
}
