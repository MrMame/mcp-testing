import type { MessageKind } from '@mcp-testing/shared';

export interface Classification {
  kind: MessageKind;
  method: string | null;
  rpcId: string | number | null;
}

/** Ordnet eine JSON-RPC-Nachricht als Request, Response, Fehler oder Notification ein. */
export function classify(message: unknown): Classification {
  const m = (typeof message === 'object' && message !== null ? message : {}) as Record<
    string,
    unknown
  >;
  const method = typeof m.method === 'string' ? m.method : null;
  const rpcId = typeof m.id === 'string' || typeof m.id === 'number' ? m.id : null;

  if (method !== null) {
    return { kind: rpcId === null ? 'notification' : 'request', method, rpcId };
  }
  return { kind: 'error' in m ? 'error' : 'response', method: null, rpcId };
}
