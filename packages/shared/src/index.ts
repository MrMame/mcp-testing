// Gemeinsame Typen für Server und Monitoring-Oberfläche.
// Dieses Paket enthält bewusst nur Typen, damit es zur Laufzeit nichts kostet.

/** Richtung einer mitgeschnittenen JSON-RPC-Nachricht. */
export type Direction = 'client->server' | 'server->client';

/** Über welchen MCP-Transport die Nachricht lief. */
export type TransportKind = 'stdio' | 'http';

/** Grobe Einordnung einer JSON-RPC-Nachricht. */
export type MessageKind = 'request' | 'response' | 'error' | 'notification';

/** Eine mitgeschnittene Nachricht zwischen MCP-Client und -Server. */
export interface MonitorEvent {
  /** Fortlaufende ID aus dem Log-Speicher. */
  id: number;
  sessionId: string;
  /** Zeitstempel in Millisekunden seit Epoch. */
  timestamp: number;
  direction: Direction;
  transport: TransportKind;
  kind: MessageKind;
  /** JSON-RPC-Methode (bei Requests und Notifications). */
  method: string | null;
  /** JSON-RPC-ID (bei Requests, Responses und Fehlern). */
  rpcId: string | number | null;
  /** Die vollständige JSON-RPC-Nachricht. */
  payload: unknown;
}

/** Eine MCP-Sitzung aus Sicht des Monitors. */
export interface SessionInfo {
  sessionId: string;
  transport: TransportKind;
  startedAt: number;
  endedAt: number | null;
  /** Name/Version des Clients aus dem initialize-Request, falls bekannt. */
  clientInfo: { name: string; version: string } | null;
}

/** Nachrichten vom Server an die Weboberfläche (WebSocket). */
export type ServerToUiMessage =
  | { type: 'event'; event: MonitorEvent }
  | { type: 'session'; session: SessionInfo };

/**
 * Nachrichten von der Weboberfläche an den Server (WebSocket).
 * Die Steuerbefehle für die Geschäftslogik werden später definiert.
 */
export type UiToServerMessage = { type: 'ping' };
