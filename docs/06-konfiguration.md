# 6. Konfigurationsdateien

## `.mcp.json`

Die wichtigste Datei mit MCP-Bezug außerhalb des Codes. Sie ist die **Host-Konfiguration** für Claude Code: Sie sagt dem Host, welche MCP-Server es für dieses Projekt gibt und wie er sie startet.

```json
{
  "mcpServers": {
    "mcp-testing": {
      "type": "stdio",
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "packages/server/src/index.ts",
        "--transport",
        "stdio",
        "--monitor-port",
        "3101"
      ]
    }
  }
}
```

| Feld                  | Bedeutung                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mcp-testing`         | Name, unter dem der Server in Claude Code erscheint. Tools heißen dort `mcp__mcp-testing__echo`.            |
| `type: stdio`         | Der Host startet den Server als Kindprozess und spricht über stdin/stdout mit ihm.                          |
| `command`, `args`     | Der Startbefehl. `--import tsx` lässt Node den TypeScript-Code direkt ausführen, ein Build ist nicht nötig. |
| `--monitor-port 3101` | Eigener Port, damit diese Instanz nicht mit `npm run dev` (Port 3001) kollidiert.                           |

Andere Hosts nutzen sehr ähnliche Formate (z. B. `claude_desktop_config.json` bei Claude Desktop). Für einen laufenden HTTP-Server sähe der Eintrag so aus: `{ "type": "http", "url": "http://127.0.0.1:3000/mcp" }`.

**Ablauf beim Start einer Claude-Code-Sitzung:** Claude Code liest `.mcp.json`, startet den Prozess, schickt `initialize`, fragt mit `tools/list` die Tools ab und stellt sie dem Modell zur Verfügung. Die ganze Unterhaltung ist danach in der Monitoring-Oberfläche unter <http://127.0.0.1:3101> sichtbar, wenn vorher `npm run build` lief (sonst zeigt die Seite nur einen Hinweis).

## Server in anderen Projekten nutzen (Bundle)

`packages/server/dist` lässt sich nicht einfach in ein anderes Projekt kopieren: `tsc` übersetzt nur den eigenen Code, die Imports von `@modelcontextprotocol/*`, `express`, `ws` und `zod` lösen sich weiterhin über `node_modules` auf. Im fremden Projekt fehlen sie, und Node bricht mit „Cannot find package '@modelcontextprotocol/express'“ ab. Der Host meldet dann nur, der Server habe sich nicht starten lassen.

Dafür gibt es `npm run bundle`. Es baut alles und packt danach mit esbuild ([`scripts/bundle.mjs`](../scripts/bundle.mjs)) den Server samt aller Abhängigkeiten in eine Datei:

```text
bundle/
├── mcp-testing-server.mjs       Server + Abhängigkeiten (eine Datei)
├── mcp-testing-server.mjs.map   Sourcemap für lesbare Stacktraces
└── web/                         gebaute Monitoring-Oberfläche
```

Vor dem Kopieren lässt sich das Bundle hier prüfen: `npm run bundled` startet `bundle/mcp-testing-server.mjs` mit dem HTTP-Transport (MCP unter <http://127.0.0.1:3200/mcp>, Oberfläche unter <http://127.0.0.1:3201>). Die eigenen Ports erlauben, es parallel zu `npm run dev` (3000/3001) und zur Claude-Code-Instanz (3101) laufen zu lassen.

Den Ordner kopiert man z. B. als `mcp-server/` in das Testprojekt. Es braucht dort nur Node.js ≥ 26, kein `npm install`. Eintrag für VS Code/Copilot in `.vscode/mcp.json` des Testprojekts:

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

`--db` sollte man angeben. Sonst landet die Datenbank in `data/monitor.db` relativ zu dem Verzeichnis, in dem der Host den Prozess startet. Die Oberfläche ist dann unter <http://127.0.0.1:3101> erreichbar.

## `.claude/`: Harness für Claude Code

Diese Dateien konfigurieren Claude Code als Entwicklungswerkzeug. Mit dem MCP-Protokoll haben sie nur an einer Stelle zu tun:

| Datei                            | Inhalt                                         | MCP-Bezug                                                                                                           |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `settings.json`                  | Erlaubte und verbotene Befehle, Hooks          | `enabledMcpjsonServers` gibt den Server aus `.mcp.json` frei; `mcp__mcp-testing` erlaubt seine Tools ohne Nachfrage |
| `hooks/format-file.mjs`          | formatiert jede bearbeitete Datei mit Biome    | –                                                                                                                   |
| `hooks/typecheck-on-stop.mjs`    | prüft Typen, bevor Claude eine Antwort beendet | –                                                                                                                   |
| `settings.local.json` (optional) | persönliche Einstellungen, nicht im Git        | –                                                                                                                   |

Der Freigabe-Schritt ist eine Sicherheitsfunktion des Hosts: Ein MCP-Server ist ein Programm mit den Rechten des Benutzers. Hosts starten ihn deshalb erst nach Zustimmung.

## `CLAUDE.md`

Arbeitsanweisungen für Claude Code, z. B. „im Server nie `console.log`“, weil das den stdio-Transport zerstört.

## `REQUIREMENTS.md`, `README.md`

Anforderungen mit Entscheidungsprotokoll bzw. Kurzanleitung.

## Build und Werkzeuge

| Datei                             | Zweck                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `package.json`                    | Workspaces und Skripte (`dev`, `build`, `check` …). `engines.node >= 26` wegen `node:sqlite`. |
| `package-lock.json`               | exakte Versionen aller Abhängigkeiten, auch des MCP SDK                                       |
| `tsconfig.base.json`              | gemeinsame TypeScript-Regeln (strikt, `nodenext`-Module)                                      |
| `tsconfig.json`                   | verweist auf `shared` und `server`; `tsc -b` baut beide in der richtigen Reihenfolge          |
| `biome.json`                      | Lint- und Format-Regeln für Code und Markdown                                                 |
| `vitest.config.ts`                | findet alle `*.test.ts` in den Paketen                                                        |
| `scripts/bundle.mjs`              | baut `bundle/` für den Einsatz in anderen Projekten (siehe oben)                              |
| `.gitignore`                      | schließt u. a. `node_modules`, `dist`, `bundle` und die Logs in `data/` aus                   |
| `.gitattributes`, `.editorconfig` | einheitliche Zeilenenden (LF) und Einrückung                                                  |
| `.nvmrc`                          | Node-Version 26 für Versionsmanager                                                           |
| `.vscode/`                        | empfohlene Erweiterungen (Biome, Vitest) und Formatieren beim Speichern                       |
| `mcp-testing.code-workspace`      | VS-Code-Arbeitsbereich                                                                        |

## `data/`

Enthält zur Laufzeit `monitor.db`, die SQLite-Datenbank mit allen mitgeschnittenen MCP-Nachrichten. Sie wird nicht ins Git übernommen, nur die leere Platzhalterdatei `.gitkeep`. Die Datenbank lässt sich mit jedem SQLite-Werkzeug öffnen, z. B. um alle `tools/call`-Anfragen einer Sitzung auszuwerten:

```sql
SELECT ts, payload FROM events WHERE method = 'tools/call' ORDER BY id;
```
