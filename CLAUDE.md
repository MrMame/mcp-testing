# CLAUDE.md

MCP-Testserver mit eingebautem Monitoring: Jede JSON-RPC-Nachricht zwischen MCP-Client und Server wird mitgeschnitten, in SQLite geloggt und live in einer React-Weboberfläche angezeigt. Über die Oberfläche soll später in die Geschäftslogik des Servers eingegriffen werden können (Umfang noch offen, siehe [REQUIREMENTS.md](REQUIREMENTS.md)).

## Sprache

Alles auf Deutsch: Doku, Kommentare, Log- und UI-Texte, Commit-Messages. Bezeichner (Variablen, Funktionen, Typen) bleiben Englisch.

## Struktur (npm-Workspaces)

- `packages/shared` – nur Typen (`MonitorEvent`, `SessionInfo`, WebSocket-Protokoll). Keine Laufzeitlogik.
- `packages/server` – MCP-Server (SDK v2: `@modelcontextprotocol/server`), Transporte, Monitor
  - `src/mcp/createMcpServer.ts` – Tools/Resources/Prompts registrieren
  - `src/mcp/stdio.ts`, `src/mcp/http.ts` – die beiden Transporte
  - `src/monitor/tappedTransport.ts` – Wrapper um jeden Transport, meldet alle Nachrichten an den `Monitor`
  - `src/monitor/monitor.ts` – zentraler Event-Hub (speichern + verteilen)
  - `src/monitor/eventStore.ts` – SQLite über `node:sqlite`
  - `src/monitor/monitorServer.ts` – REST (`/api`), WebSocket (`/ws`), Auslieferung von `packages/web/dist`
- `packages/web` – React + Vite, Dev-Server proxyt `/api` und `/ws` auf den Monitor-Port

## Befehle

```bash
npm run dev         # Server (HTTP-Transport, :3000/mcp) + Monitor (:3001) + Vite (:5173)
npm run build       # alle Pakete bauen
npm run check       # typecheck + lint + test – vor jedem Commit
npm run typecheck   # tsc -b (shared, server) und tsc -p packages/web
npm run lint        # biome check
npm run format      # biome check --write
npm test            # vitest run
```

## Wichtige Regeln

- **stdout ist im stdio-Modus heilig.** Nie `console.log` im Server, immer `log` aus `src/log.ts` (schreibt nach stderr).
- **Monitoring darf den MCP-Verkehr nie stören.** Fehler beim Aufzeichnen werden geloggt, nicht geworfen.
- Neue MCP-Verbindungen immer über `TappedTransport` an den `McpServer` hängen, sonst fehlen sie im Monitor.
- Typen, die Server und Web teilen, gehören nach `packages/shared`.
- Relative Imports im Server mit `.js`-Endung (`nodenext`).
- Server-Code bindet nur an `127.0.0.1`; der Monitor prüft Host-Header und WebSocket-Origin.
- Tests liegen neben dem Code (`*.test.ts`). Für MCP-Abläufe einen echten `Client` aus `@modelcontextprotocol/client` verwenden (`InMemoryTransport` oder HTTP auf Port 0), siehe vorhandene Tests.

## Harness

- `.claude/settings.json`: Berechtigungen, Hooks, Freigabe des Projekt-MCP-Servers.
- Hook `format-file.mjs` (nach Write/Edit): Biome formatiert die Datei und meldet verbleibende Lint-Fehler zurück.
- Hook `typecheck-on-stop.mjs` (Stop): Typecheck bei geänderten TS-Dateien; bei Fehlern muss weitergearbeitet werden.
- `.mcp.json`: startet den eigenen Server per stdio (`mcp-testing`, Monitor auf Port 3101), damit Claude Code ihn direkt testen kann. Logs landen in `data/monitor.db`.

## Ports

| Port | Zweck                                                 |
| ---- | ----------------------------------------------------- |
| 3000 | MCP Streamable HTTP (`/mcp`)                          |
| 3001 | Monitor-API/WebSocket/UI (`npm run dev`)              |
| 3101 | Monitor der von Claude Code gestarteten stdio-Instanz |
| 5173 | Vite-Dev-Server der UI                                |
