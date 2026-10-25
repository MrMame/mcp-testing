# mcp-testing

MCP-Testserver (TypeScript/Node.js) mit Monitoring-Weboberfläche: Alle Nachrichten zwischen MCP-Client und Server werden mitgeschnitten, in SQLite gespeichert und live angezeigt.

## Voraussetzungen

- Node.js ≥ 26 (wegen `node:sqlite`)
- npm ≥ 11

## Schnellstart

```bash
npm install
npm run dev
```

- MCP-Endpunkt (Streamable HTTP): <http://127.0.0.1:3000/mcp>
- Monitoring-Oberfläche: <http://localhost:5173>

Zum Ausprobieren eignet sich z. B. der MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
# Transport "Streamable HTTP", URL http://127.0.0.1:3000/mcp
```

## npm-Skripte

Alle Skripte werden im Root-Verzeichnis mit `npm run <name>` aufgerufen (`start` und `test` auch ohne `run`).

### Entwickeln

| Skript        | Was es tut                                                                                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` | Startet den Server aus dem TypeScript-Quellcode mit Neustart bei Änderungen (HTTP-Transport, MCP auf :3000, Monitor auf :3001) und den Vite-Dev-Server für die UI auf :5173. Die Oberfläche öffnet man unter <http://localhost:5173>. Beenden mit `Strg+C`. |

### Bauen und starten

| Skript            | Was es tut                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`   | Baut `shared`, `server` und `web` nach `packages/*/dist`. Voraussetzung für `start` und dafür, dass der Monitor die UI selbst ausliefert.                                                                                                                     |
| `npm start`       | Startet den gebauten Server (`packages/server/dist/index.js`). Ohne Optionen läuft er im **stdio**-Modus und wartet auf JSON-RPC über stdin – gedacht für den Start durch einen MCP-Host. Optionen nach `--` anhängen, z. B. `npm start -- --transport http`. |
| `npm run bundle`  | Führt `build` aus und erzeugt danach `bundle/`: der Server samt aller Abhängigkeiten in einer Datei plus die UI. Diesen Ordner kann man in andere Projekte kopieren (siehe unten).                                                                            |
| `npm run bundled` | Startet das gebaute Bundle zum Prüfen (HTTP-Transport, MCP auf <http://127.0.0.1:3200/mcp>, Monitor auf <http://127.0.0.1:3201>). Die eigenen Ports erlauben den parallelen Betrieb mit `npm run dev`. Vorher `npm run bundle` ausführen.                     |

### Qualität prüfen

| Skript               | Was es tut                                                                   |
| -------------------- | ---------------------------------------------------------------------------- |
| `npm run check`      | `typecheck`, `lint` und `test` nacheinander. **Vor jedem Commit ausführen.** |
| `npm run typecheck`  | TypeScript-Typprüfung aller Pakete, ohne Dateien zu erzeugen                 |
| `npm run lint`       | Lint- und Formatprüfung mit Biome, ändert nichts                             |
| `npm run format`     | wie `lint`, behebt dabei Formatierung und automatisch korrigierbare Befunde  |
| `npm test`           | alle Tests (`*.test.ts`) einmal mit Vitest                                   |
| `npm run test:watch` | Tests im Watch-Modus, laufen bei jeder Änderung neu                          |

### Typische Abläufe

```bash
# Entwickeln
npm run dev

# Vor dem Commit
npm run format
npm run check

# Bundle für ein anderes Projekt erzeugen und vorher prüfen
npm run bundle
npm run bundled          # Strg+C zum Beenden
```

## In anderen Projekten nutzen

`npm run bundle` ausführen und den Ordner `bundle/` z. B. als `mcp-server/` ins Zielprojekt kopieren. Dort ist nur Node.js ≥ 26 nötig, kein `npm install`. Eintrag in `.vscode/mcp.json` des Zielprojekts:

```json
{
  "servers": {
    "mcp-testing": {
      "type": "stdio",
      "command": "node",
      "args": [
        "${workspaceFolder}/mcp-server/mcp-testing-server.mjs",
        "--transport",
        "stdio",
        "--monitor-port",
        "3101",
        "--db",
        "${workspaceFolder}/mcp-server/data/monitor.db"
      ]
    }
  }
}
```

Die Monitoring-Oberfläche ist dann unter <http://127.0.0.1:3101> erreichbar. Details: [docs/06-konfiguration.md](docs/06-konfiguration.md#server-in-anderen-projekten-nutzen-bundle).

Nur `packages/server/dist` zu kopieren reicht nicht: Darin fehlen die npm-Abhängigkeiten, und der Start scheitert mit „Cannot find package '@modelcontextprotocol/express'“.

## Als stdio-Server einbinden

```bash
npm run build
node packages/server/dist/index.js --transport stdio --monitor-port 3001
```

Die Monitoring-Oberfläche läuft dann unter <http://127.0.0.1:3001> (nach `npm run build` mit ausgelieferter UI).

Optionen: `node packages/server/dist/index.js --help`

## Weitere Doku

- [docs/](docs/README.md) – Projekt und Dateien erklärt, jeweils mit Bezug zum MCP-Protokoll
- [REQUIREMENTS.md](REQUIREMENTS.md) – Anforderungen
- [CLAUDE.md](CLAUDE.md) – Architektur, Befehle und Konventionen
