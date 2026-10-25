import type { MonitorEvent } from '@mcp-testing/shared';
import { useMemo, useState } from 'react';
import { useMonitor } from './useMonitor.js';

const CONNECTION_LABEL = { connecting: 'verbinde …', open: 'live', closed: 'getrennt' } as const;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString('de-DE')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function label(e: MonitorEvent): string {
  if (e.method) return e.method;
  return e.kind === 'error' ? 'Fehler' : 'Antwort';
}

export function App() {
  const { events, sessions, connection } = useMonitor();
  const [sessionFilter, setSessionFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const visible = useMemo(
    () => (sessionFilter ? events.filter((e) => e.sessionId === sessionFilter) : events),
    [events, sessionFilter],
  );
  const selected = events.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="layout">
      <header>
        <h1>MCP Monitor</h1>
        <span className={`status status-${connection}`}>{CONNECTION_LABEL[connection]}</span>
      </header>

      <aside>
        <h2>Sessions</h2>
        <button
          type="button"
          className={sessionFilter === null ? 'active' : ''}
          onClick={() => setSessionFilter(null)}
        >
          Alle ({events.length})
        </button>
        {sessions.map((s) => (
          <button
            type="button"
            key={s.sessionId}
            className={sessionFilter === s.sessionId ? 'active' : ''}
            onClick={() => setSessionFilter(s.sessionId)}
            title={s.sessionId}
          >
            <strong>{s.clientInfo?.name ?? 'unbekannt'}</strong> · {s.transport}
            <small>
              {formatTime(s.startedAt)}
              {s.endedAt ? ' · beendet' : ''}
            </small>
          </button>
        ))}
      </aside>

      <main>
        <table>
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Richtung</th>
              <th>Typ</th>
              <th>Methode</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr
                key={e.id}
                className={`${e.kind} ${e.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(e.id)}
              >
                <td>{formatTime(e.timestamp)}</td>
                <td>{e.direction === 'client->server' ? 'Client → Server' : 'Server → Client'}</td>
                <td>{e.kind}</td>
                <td>{label(e)}</td>
                <td>{e.rpcId ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="empty">Noch keine Nachrichten aufgezeichnet.</p>}
      </main>

      <section className="detail">
        <h2>Details</h2>
        {selected ? (
          <pre>{JSON.stringify(selected.payload, null, 2)}</pre>
        ) : (
          <p className="empty">Nachricht in der Liste auswählen.</p>
        )}
      </section>
    </div>
  );
}
