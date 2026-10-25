// Logging geht immer nach stderr: im stdio-Modus gehört stdout ausschließlich dem MCP-Protokoll.

type Level = 'debug' | 'info' | 'warn' | 'error';

function write(level: Level, msg: string, extra?: unknown): void {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`;
  process.stderr.write(extra === undefined ? `${line}\n` : `${line} ${JSON.stringify(extra)}\n`);
}

export const log = {
  debug: (msg: string, extra?: unknown) => write('debug', msg, extra),
  info: (msg: string, extra?: unknown) => write('info', msg, extra),
  warn: (msg: string, extra?: unknown) => write('warn', msg, extra),
  error: (msg: string, extra?: unknown) => write('error', msg, extra),
};
