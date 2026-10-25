// PostToolUse-Hook (Write|Edit): formatiert die geänderte Datei mit Biome und wendet sichere
// Lint-Fixes an. Verbleibende Lint-Befunde werden Claude als Kontext zurückgemeldet.
// Der Hook blockiert nie; Fehler im Hook selbst werden ignoriert.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.css',
  '.md',
]);
const MAX_CONTEXT = 3000;

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

const input = JSON.parse(raw || '{}');
const file = input.tool_input?.file_path ?? input.tool_response?.filePath;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const biome = resolve(root, 'node_modules/@biomejs/biome/bin/biome');

if (!file || !EXTENSIONS.has(extname(file)) || !existsSync(biome)) process.exit(0);

const rel = relative(root, resolve(file));
// Unter Windows liefert relative() bei anderem Laufwerk einen absoluten Pfad statt '..'.
if (rel.startsWith('..') || isAbsolute(rel) || rel.includes('node_modules')) process.exit(0);

const result = spawnSync(
  process.execPath,
  [biome, 'check', '--write', '--no-errors-on-unmatched', '--colors=off', rel],
  { cwd: root, encoding: 'utf8' },
);

if (result.status !== 0) {
  const output = `${result.stdout}${result.stderr}`.trim().slice(0, MAX_CONTEXT);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `Biome meldet in ${rel} Befunde, die nicht automatisch behoben wurden:\n${output}`,
      },
    }),
  );
}
