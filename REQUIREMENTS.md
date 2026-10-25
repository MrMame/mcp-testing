# Anforderungen: MCP-Testserver mit Monitoring

> Stand: 25.10.2026 · Status: **Entwurf**, wird gemeinsam weiterentwickelt.
> Legende: ✅ umgesetzt · 🟡 teilweise · ⬜ offen · ❓ zu klären

## 1. Ziel

Eine MCP-Testserver-Applikation, mit der sich das Zusammenspiel zwischen MCP-Clients (z. B. Claude Code, Claude Desktop, MCP Inspector) und einem MCP-Server beobachten, aufzeichnen und gezielt beeinflussen lässt. Eine Weboberfläche zeigt den Nachrichtenverkehr live und erlaubt Eingriffe in die Geschäftslogik des Servers.

### Einsatzzwecke

1. **MCP-Clients testen:** prüfen, wie sich Clients (Claude Code, Claude Desktop, MCP Inspector …) verhalten
2. **MCP lernen und verstehen:** den Nachrichtenfluss des Protokolls sichtbar und nachvollziehbar machen
3. **Demo und Schulung:** anderen zeigen, wie MCP funktioniert

Daraus folgt: Die Oberfläche soll auch für MCP-Einsteiger verständlich sein (z. B. erklärende Bezeichnungen, Request/Response-Zuordnung).

## 2. Begriffe

| Begriff        | Bedeutung                                                                      |
| -------------- | ------------------------------------------------------------------------------ |
| Client         | MCP-Client, der sich mit dem Testserver verbindet                              |
| Session        | Eine Verbindung eines Clients (stdio: Prozesslaufzeit; HTTP: `Mcp-Session-Id`) |
| Event          | Eine mitgeschnittene JSON-RPC-Nachricht mit Richtung, Zeitstempel und Session  |
| Geschäftslogik | Tools, Resources und Prompts, die der Testserver anbietet, und ihr Verhalten   |

## 3. Technische Rahmenbedingungen (entschieden)

| ID  | Entscheidung                                                                 |
| --- | ---------------------------------------------------------------------------- |
| T-1 | TypeScript, Node.js ≥ 26, npm-Workspaces (`shared`, `server`, `web`)         |
| T-2 | Offizielles MCP TypeScript SDK v2 (`@modelcontextprotocol/server`)           |
| T-3 | Monitoring ist im Server eingebaut (Transport-Wrapper), kein separater Proxy |
| T-4 | Transporte: stdio und Streamable HTTP                                        |
| T-5 | Weboberfläche: React + Vite, Live-Updates per WebSocket                      |
| T-6 | Persistenz der Logs in SQLite (`node:sqlite`)                                |
| T-7 | Tooling: Biome (Lint/Format), Vitest (Tests)                                 |
| T-8 | Nur lokale Nutzung: Server, API und UI nur auf `127.0.0.1`, keine Anmeldung  |

## 4. Funktionale Anforderungen

### 4.1 MCP-Server

| ID   | Anforderung                                                                                       | Status |
| ---- | ------------------------------------------------------------------------------------------------- | ------ |
| FA-1 | Server ist per stdio startbar (Einbindung in Claude Code/Desktop)                                 | ✅     |
| FA-2 | Server ist per Streamable HTTP unter `/mcp` erreichbar, mit mehreren parallelen Sessions          | ✅     |
| FA-3 | Server bietet Tools an (aktuell nur Platzhalter `echo`)                                           | 🟡     |
| FA-4 | Server bietet Resources an                                                                        | ❓     |
| FA-5 | Server bietet Prompts an                                                                          | ❓     |
| FA-6 | Weitere MCP-Features (Sampling, Elicitation, Logging, Progress, Notifications wie `list_changed`) | ❓     |

### 4.2 Monitoring und Logging

| ID    | Anforderung                                                                                                      | Status |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| FM-1  | Jede JSON-RPC-Nachricht in beide Richtungen wird mit Zeitstempel, Richtung, Session, Typ, Methode und ID erfasst | ✅     |
| FM-2  | Alle Events werden dauerhaft in SQLite gespeichert                                                               | ✅     |
| FM-3  | Sessions werden mit Transport, Start/Ende und Client-Info (aus `initialize`) erfasst                             | ✅     |
| FM-4  | Weboberfläche zeigt Events live (WebSocket)                                                                      | ✅     |
| FM-5  | Filter nach Session                                                                                              | ✅     |
| FM-6  | Detailansicht mit vollständigem JSON einer Nachricht                                                             | ✅     |
| FM-7  | Weitere Filter/Suche (Methode, Typ, Volltext, Zeitraum)                                                          | ⬜     |
| FM-8  | Zuordnung Request ↔ Response mit Antwortzeit                                                                     | ⬜     |
| FM-9  | Export der Logs (z. B. JSONL)                                                                                    | ⬜     |
| FM-10 | Logs werden unbegrenzt aufbewahrt; die UI kann alle Logs oder einzelne Sessions löschen                          | ⬜     |

### 4.3 Steuerung über die Weboberfläche

| ID   | Anforderung                                                                       | Status |
| ---- | --------------------------------------------------------------------------------- | ------ |
| FS-1 | Die Weboberfläche kann in die Geschäftslogik des Servers eingreifen               | ❓     |
| FS-2 | Rückkanal UI → Server über WebSocket ist vorhanden (Befehle noch nicht definiert) | 🟡     |

## 5. Nicht-funktionale Anforderungen

| ID   | Anforderung                                                                           | Status                    |
| ---- | ------------------------------------------------------------------------------------- | ------------------------- |
| NF-1 | Monitoring darf den MCP-Verkehr nie unterbrechen oder verfälschen                     | ✅                        |
| NF-2 | Im stdio-Modus darf nichts außer MCP-Nachrichten auf stdout landen                    | ✅                        |
| NF-3 | Schutz vor Zugriff fremder Webseiten (Host-Header- und Origin-Prüfung)                | ✅                        |
| NF-4 | Startet auch ohne Oberfläche, wenn der Monitor-Port belegt ist (Logging läuft weiter) | ✅                        |
| NF-5 | Läuft unter Windows, macOS und Linux                                                  | 🟡 (nur Windows getestet) |

## 6. Offene Fragen (nächste Besprechung)

1. **Geschäftslogik (FA-3 bis FA-6):** Welche Tools, Resources und Prompts soll der Server anbieten?
2. **Eingriffe (FS-1):** Welche Arten von Eingriffen über die UI? Beispiele:
   - Tools zur Laufzeit an-/abschalten oder neu definieren (mit `list_changed`-Notification)
   - Antworten verzögern, verändern oder Fehler erzwingen
   - Requests anhalten und manuell freigeben („Breakpoints“)
   - Nachrichten vom Server an den Client senden (Logging, Sampling, Elicitation)

## 7. Entscheidungsprotokoll

| Datum      | Entscheidung                                                                       |
| ---------- | ---------------------------------------------------------------------------------- |
| 25.10.2026 | Architektur, Transporte, Frontend, Persistenz und Tooling festgelegt (Abschnitt 3) |
| 25.10.2026 | Einsatzzwecke: Clients testen, MCP lernen, Demo/Schulung                           |
| 25.10.2026 | Logs unbegrenzt aufbewahren, Löschen über die UI (FM-10)                           |
| 25.10.2026 | Nur lokale Nutzung ohne Authentifizierung (T-8)                                    |
| 25.10.2026 | Geschäftslogik und UI-Eingriffe werden in einer eigenen Besprechung festgelegt     |
