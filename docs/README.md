# Dokumentation: mcp-testing

Diese Dokumentation erklärt das Projekt Datei für Datei und zeigt jeweils, **welche Rolle das Stück Code im Model Context Protocol (MCP) spielt**. Sie richtet sich an alle, die das Projekt verstehen und dabei MCP selbst kennenlernen wollen.

## Lesereihenfolge

| Nr. | Dokument                                         | Inhalt                                                                         |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | [MCP-Grundlagen](01-mcp-grundlagen.md)           | Rollen, JSON-RPC, Lebenszyklus, Fähigkeiten, Transporte – das nötige Vorwissen |
| 2   | [Verzeichnisstruktur](02-verzeichnisstruktur.md) | Überblick über alle Ordner und welcher MCP-Rolle sie entsprechen               |
| 3   | [Nachrichtenfluss](03-nachrichtenfluss.md)       | Echte, mitgeschnittene Nachrichten einer Sitzung, Schritt für Schritt          |
| 4   | [Server-Paket](04-server.md)                     | Jede Datei in `packages/server` und ihr Bezug zum Protokoll                    |
| 5   | [Shared und Web](05-shared-und-web.md)           | Gemeinsame Typen und die Monitoring-Oberfläche                                 |
| 6   | [Konfigurationsdateien](06-konfiguration.md)     | Dateien im Wurzelverzeichnis, `.mcp.json` und der Claude-Code-Harness          |

## Das Projekt in einem Satz

`mcp-testing` ist ein **MCP-Server**, der jede JSON-RPC-Nachricht, die er mit einem **MCP-Client** austauscht, mitschneidet, in einer Datenbank speichert und in einer Weboberfläche live anzeigt.

```text
┌─────────────────────────────┐            ┌────────────────────────────────────┐
│ Host (z. B. Claude Code)    │            │ mcp-testing (dieses Projekt)       │
│  ┌───────────────────────┐  │  JSON-RPC  │  ┌──────────────────────────────┐  │
│  │ MCP-Client            │◄─┼────────────┼─►│ MCP-Server  (+ Mitschnitt)   │  │
│  └───────────────────────┘  │ stdio/HTTP │  └──────────────┬───────────────┘  │
└─────────────────────────────┘            │                 ▼                  │
                                           │   SQLite  ──►  Weboberfläche       │
                                           └────────────────────────────────────┘
```

## Hinweis zur Aktualität

Die Beispiele wurden am 25.10.2026 mit dem MCP TypeScript SDK 2.4 und der Protokollversion `2025-11-25` erzeugt. Wenn sich Code oder Protokoll ändern, müssen diese Dokumente mitgepflegt werden.
