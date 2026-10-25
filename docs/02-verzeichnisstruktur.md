# 2. Verzeichnisstruktur

Ohne `node_modules/`, Build-Ausgaben (`dist/`) und Laufzeitdaten.

```text
mcp-testing/
├── packages/                    npm-Workspaces (drei Teilpakete)
│   ├── shared/                  Typen, die Server und Oberfläche teilen
│   │   └── src/index.ts         MonitorEvent, SessionInfo, WebSocket-Nachrichten
│   │
│   ├── server/                  ► der MCP-Server
│   │   └── src/
│   │       ├── index.ts         Einstiegspunkt: Konfiguration lesen, alles starten
│   │       ├── config.ts        Kommandozeilen-Optionen (Transport, Ports, DB)
│   │       ├── log.ts           Logging nach stderr
│   │       ├── mcp/             ► MCP-Schicht: was der Server anbietet und wie er erreichbar ist
│   │       │   ├── createMcpServer.ts   Tools/Resources/Prompts registrieren
│   │       │   ├── stdio.ts             Transport stdio
│   │       │   ├── http.ts              Transport Streamable HTTP mit Sessions
│   │       │   └── http.test.ts         End-to-End-Test über HTTP
│   │       └── monitor/         ► Mitschnitt des JSON-RPC-Verkehrs
│   │           ├── tappedTransport.ts   Hülle um den Transport, sieht jede Nachricht
│   │           ├── tappedTransport.test.ts
│   │           ├── classify.ts          Request/Response/Error/Notification erkennen
│   │           ├── monitor.ts           zentrale Sammelstelle, Sitzungen verfolgen
│   │           ├── eventStore.ts        Speicherung in SQLite
│   │           └── monitorServer.ts     REST-API + WebSocket + Auslieferung der UI
│   │
│   └── web/                     ► Monitoring-Oberfläche (React + Vite)
│       ├── index.html
│       ├── vite.config.ts       Dev-Server, leitet /api und /ws an den Monitor weiter
│       └── src/
│           ├── main.tsx         React-Einstieg
│           ├── App.tsx          Sitzungsliste, Nachrichtentabelle, Detailansicht
│           ├── useMonitor.ts    Verlauf laden + Live-Updates per WebSocket
│           └── styles.css
│
├── docs/                        diese Dokumentation
├── data/                        SQLite-Datenbank mit den Logs (nicht im Git)
│
├── .claude/                     Konfiguration für Claude Code (Harness)
│   ├── settings.json            Berechtigungen, Hooks, Freigabe des MCP-Servers
│   └── hooks/                   Format- und Typecheck-Skripte
├── .mcp.json                    ► meldet diesen Server bei Claude Code als MCP-Server an
├── .vscode/                     Editor-Einstellungen
│
├── CLAUDE.md                    Arbeitsanweisungen für Claude Code
├── README.md                    Kurzanleitung
├── REQUIREMENTS.md              Anforderungen und Entscheidungen
├── package.json                 Workspaces und Skripte
├── tsconfig.base.json           gemeinsame TypeScript-Einstellungen
├── tsconfig.json                Verweis auf die Teilprojekte
├── biome.json                   Lint- und Format-Regeln
├── vitest.config.ts             Test-Konfiguration
└── .gitignore, .gitattributes, .editorconfig, .nvmrc
```

## Zuordnung zu den MCP-Rollen

| Bereich                        | Rolle im MCP-Bild                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `packages/server/src/mcp/`     | **Server**: Fähigkeiten (Tools) und **Transporte**                                       |
| `packages/server/src/monitor/` | Kein MCP-Bestandteil. Sitzt zwischen Transport und Protokoll und beobachtet.             |
| `packages/web/`                | Kein MCP-Bestandteil. Zeigt an, was der Monitor gesehen hat.                             |
| `packages/shared/`             | Beschreibt, wie eine mitgeschnittene JSON-RPC-Nachricht gespeichert und übertragen wird. |
| `.mcp.json`                    | Konfiguration des **Hosts** (Claude Code): wie er den Server startet                     |
| Tests (`*.test.ts`)            | Spielen den **Client**, um den Server realistisch zu prüfen                              |

## Warum drei Pakete?

- **Trennung von Server und Oberfläche:** Der Server läuft in Node.js, die Oberfläche im Browser. Sie haben unterschiedliche Abhängigkeiten und Build-Schritte.
- **Ein gemeinsamer Vertrag:** Beide müssen sich einig sein, wie ein mitgeschnittenes Event aussieht. Das legt `shared` an einer Stelle fest; ändert sich der Typ, meldet der Typecheck die betroffenen Stellen auf beiden Seiten.

## Zwei Netzwerkkanäle, nicht verwechseln

Im HTTP-Modus laufen zwei getrennte Server:

| Port | Kanal              | Protokoll                        | Gesprächspartner     |
| ---- | ------------------ | -------------------------------- | -------------------- |
| 3000 | `/mcp`             | **MCP** (JSON-RPC über HTTP)     | MCP-Client           |
| 3001 | `/api`, `/ws`, `/` | eigenes REST/WebSocket-Protokoll | Browser (Oberfläche) |

Nur der erste Kanal ist MCP. Der zweite ist das Werkzeug, mit dem man den ersten beobachtet. Im stdio-Modus entfällt Port 3000, weil MCP dann über stdin/stdout läuft.
