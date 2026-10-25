// Baut einen eigenständigen Ordner `bundle/`, den man in andere Projekte kopieren kann:
//   bundle/mcp-testing-server.mjs  – Server samt aller npm-Abhängigkeiten in einer Datei
//   bundle/web/                    – die gebaute Monitoring-Oberfläche
// Zur Laufzeit wird nur Node.js (>= 26, wegen node:sqlite) gebraucht, kein node_modules.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = `${root}bundle`;
const webDist = `${root}packages/web/dist`;

if (!existsSync(webDist)) {
  console.error('packages/web/dist fehlt – vorher "npm run build" ausführen.');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });

await build({
  entryPoints: [`${root}packages/server/src/index.ts`],
  outfile: `${outDir}/mcp-testing-server.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  sourcemap: true,
  // Express & Co. sind CommonJS und rufen require() für Node-Module auf.
  // Im ESM-Bundle gibt es kein globales require, daher wird es hier bereitgestellt.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

cpSync(webDist, `${outDir}/web`, { recursive: true });
console.log(`Fertig: ${outDir}`);
