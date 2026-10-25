import type { MonitorEvent, ServerToUiMessage, SessionInfo } from '@mcp-testing/shared';
import { useEffect, useState } from 'react';

export type ConnectionState = 'connecting' | 'open' | 'closed';

/** Maximale Anzahl Events, die die Oberfläche im Speicher hält. */
const MAX_EVENTS = 2000;

/** Lädt den Log-Verlauf und hält ihn über den WebSocket live aktuell. */
export function useMonitor() {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = async () => {
      setConnection('connecting');
      try {
        const [ev, se] = await Promise.all([
          fetch('/api/events?limit=500').then((r) => r.json() as Promise<MonitorEvent[]>),
          fetch('/api/sessions').then((r) => r.json() as Promise<SessionInfo[]>),
        ]);
        setEvents(ev);
        setSessions(se);
      } catch {
        // Server noch nicht erreichbar; der WebSocket-Reconnect versucht es erneut.
      }
      if (disposed) return;

      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${proto}://${location.host}/ws`);
      socket.onopen = () => setConnection('open');
      socket.onclose = () => {
        setConnection('closed');
        if (!disposed) retry = setTimeout(connect, 2000);
      };
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as ServerToUiMessage;
        if (msg.type === 'event') {
          setEvents((prev) => [...prev, msg.event].slice(-MAX_EVENTS));
        } else {
          setSessions((prev) => [
            msg.session,
            ...prev.filter((s) => s.sessionId !== msg.session.sessionId),
          ]);
        }
      };
    };

    void connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return { events, sessions, connection };
}
