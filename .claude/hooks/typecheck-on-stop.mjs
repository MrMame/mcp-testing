// Stop-Hook: führt den TypeScript-Typecheck aus, bevor Claude die Antwort beendet.
// Bei Fehlern wird mit Exit-Code 2 abgebrochen, damit Claude die Fehler sieht und behebt.
// Läuft nur, wenn es uncommittete Änderungen an TypeScript-Dateien gibt.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const MAX_OUTPUT = 4000;

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');

// Schon einmal wegen dieses Hooks weitergemacht: nicht in eine Endlosschleife laufen.
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
  cwd: root,
  encoding: 'utf8',
});
const changed = status.stdout
  .split('\n')
  .some((line) => /\.(ts|tsx)$|tsconfig[^/]*\.json$/.test(line.trim()));
if (!changed) process.exit(0);

const tsc = resolve(root, 'node_modules/typescript/bin/tsc');
for (const args of [['-b'], ['-p', 'packages/web']]) {
  const result = spawnSync(process.execPath, [tsc, ...args, '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`.trim().slice(0, MAX_OUTPUT);
    process.stderr.write(`Typecheck fehlgeschlagen (tsc ${args.join(' ')}):\n${output}\n`);
    process.exit(2);
  }
}
