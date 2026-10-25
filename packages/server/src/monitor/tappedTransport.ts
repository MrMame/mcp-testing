import type { TransportKind } from '@mcp-testing/shared';
import type {
  JSONRPCMessage,
  MessageExtraInfo,
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/server';
import type { Monitor } from './monitor.js';

export interface TappedTransportOptions {
  kind: TransportKind;
  /** Session-ID für das Monitoring, solange der Transport keine eigene liefert (stdio). */
  fallbackSessionId: string;
  /** Wird nach dem Schließen des Transports aufgerufen. */
  onClosed?: (sessionId: string) => void;
}

/**
 * Hüllt einen beliebigen MCP-Transport ein und meldet jede ein- und ausgehende
 * Nachricht an den Monitor. Der McpServer wird mit diesem Wrapper statt mit dem
 * eigentlichen Transport verbunden.
 */
export class TappedTransport implements Transport {
  onclose?: (() => void) | undefined;
  onerror?: ((error: Error) => void) | undefined;
  onmessage?:
    | (<T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void)
    | undefined;

  readonly #inner: Transport;
  readonly #monitor: Monitor;
  readonly #options: TappedTransportOptions;

  constructor(inner: Transport, monitor: Monitor, options: TappedTransportOptions) {
    this.#inner = inner;
    this.#monitor = monitor;
    this.#options = options;
  }

  get sessionId(): string | undefined {
    return this.#inner.sessionId;
  }

  get hasPerRequestStream(): boolean | undefined {
    return this.#inner.hasPerRequestStream;
  }

  get monitorSessionId(): string {
    return this.#inner.sessionId ?? this.#options.fallbackSessionId;
  }

  async start(): Promise<void> {
    this.#inner.onmessage = (message, extra) => {
      this.#monitor.record(this.monitorSessionId, this.#options.kind, 'client->server', message);
      this.onmessage?.(message, extra);
    };
    this.#inner.onerror = (error) => this.onerror?.(error);
    this.#inner.onclose = () => {
      const sessionId = this.monitorSessionId;
      this.#monitor.endSession(sessionId);
      this.onclose?.();
      this.#options.onClosed?.(sessionId);
    };
    await this.#inner.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    this.#monitor.record(this.monitorSessionId, this.#options.kind, 'server->client', message);
    await this.#inner.send(message, options);
  }

  close(): Promise<void> {
    return this.#inner.close();
  }

  setProtocolVersion(version: string): void {
    this.#inner.setProtocolVersion?.(version);
  }

  setSupportedProtocolVersions(versions: string[]): void {
    this.#inner.setSupportedProtocolVersions?.(versions);
  }
}
