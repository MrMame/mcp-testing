# 4. Das Server-Paket (`packages/server`)

Hier steckt der eigentliche MCP-Server. Die Dateien sind in der Reihenfolge erklärt, in der eine Nachricht sie durchläuft: vom Start über den Transport bis in die Datenbank.

```text
index.ts ──► config.ts
   │
   ├──► monitor/monitorServer.ts   (Oberfläche, Port 3001)
   │
   └──► mcp/stdio.ts  oder  mcp/http.ts
              │
              ▼
        Transport des SDK ──► monitor/tappedTransport.ts ──► McpServer (mcp/createMcpServer.ts)
                                     │
                                     ▼
                              monitor/monitor.ts ──► monitor/classify.ts
                                     │
                                     ├──► monitor/eventStore.ts (SQLite)
                                     └──► monitorServer.ts ──► WebSocket ──► Browser
```

---

## `src/index.ts`: Einstiegspunkt

**Was die Datei tut:** Liest die Konfiguration, öffnet die Datenbank, startet die Monitoring-Oberfläche und danach den MCP-Server mit dem gewählten Transport.

**Bezug zu MCP:**

- Hier fällt die Entscheidung **stdio oder Streamable HTTP** (siehe [Grundlagen 1.6](01-mcp-grundlagen.md#16-transporte-wie-die-nachrichten-übertragen-werden)).
- Kann die Oberfläche nicht starten (z. B. Port belegt), läuft der MCP-Server trotzdem weiter. Ein Host wie Claude Code soll den Server nicht verlieren, nur weil das Beobachtungswerkzeug fehlt.
- Die erste Zeile `#!/usr/bin/env node` erlaubt es, den gebauten Server direkt als Programm zu starten. Genau das macht ein Host bei stdio: Er startet einen Prozess.

## `src/config.ts`: Optionen

**Was die Datei tut:** Wertet `--transport`, `--port`, `--monitor-port` und `--db` aus, ersatzweise Umgebungsvariablen (`MCP_TRANSPORT`, `MCP_PORT`, `MONITOR_PORT`, `MONITOR_DB`).

**Bezug zu MCP:** Hosts starten stdio-Server mit festen Argumenten und optionalen Umgebungsvariablen. Beides ist in der Konfigurationsdatei des Hosts hinterlegt (hier [`.mcp.json`](06-konfiguration.md#mcpjson)). Ein Server sollte deshalb über genau diese beiden Wege konfigurierbar sein.

## `src/log.ts`: Logging

**Was die Datei tut:** Schreibt Log-Zeilen mit Zeitstempel nach **stderr**.

**Bezug zu MCP:** Beim stdio-Transport ist stdout der Protokollkanal. Jede Zeile dort muss eine gültige JSON-RPC-Nachricht sein. Ein einziges `console.log("Hallo")` würde der Client als kaputte Nachricht lesen. Deshalb gilt im ganzen Server: nur `log` verwenden, nie `console.log`. Hosts zeigen stderr meist in ihrem eigenen Log an (Claude Code z. B. über `claude --debug`).

> Nicht verwechseln: MCP hat auch eine eigene Log-Funktion (`notifications/message`), mit der ein Server Meldungen **über das Protokoll** an den Client schickt. `log.ts` ist dagegen nur das interne Prozess-Log.

---

## `src/mcp/createMcpServer.ts`: die Fähigkeiten des Servers

**Was die Datei tut:** Erzeugt eine `McpServer`-Instanz mit Name und Version und registriert das Tool `echo`.

**Bezug zu MCP:**

| Code                                          | Wird im Protokoll zu …                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `new McpServer({ name, version })`            | `serverInfo` in der Antwort auf `initialize`                                              |
| `registerTool('echo', …)`                     | Eintrag in `tools/list`, außerdem `capabilities.tools` bei der Initialisierung            |
| `title`, `description`                        | Felder in `tools/list`, die das Modell liest                                              |
| `inputSchema: z.object({ text: … })`          | `inputSchema` als JSON Schema in `tools/list`; das SDK prüft eingehende Argumente dagegen |
| Rückgabe `{ content: [{ type: 'text', … }] }` | `result` der Antwort auf `tools/call`                                                     |

**Warum eine Funktion statt einer einzigen Instanz?** Eine `McpServer`-Instanz gehört zu genau **einer** Verbindung, denn sie merkt sich die ausgehandelte Protokollversion und die Fähigkeiten des Clients. Bei HTTP mit mehreren Clients braucht jede Sitzung ihre eigene Instanz, also wird diese Funktion pro Sitzung aufgerufen.

**Hier kommt später die Geschäftslogik hin:** weitere Tools (`registerTool`), Resources (`registerResource`) und Prompts (`registerPrompt`).

## `src/mcp/stdio.ts`: Transport stdio

**Was die Datei tut:** Erzeugt einen `StdioServerTransport`, legt den `TappedTransport` darum und verbindet den `McpServer` damit.

**Bezug zu MCP:**

- Der `StdioServerTransport` des SDK liest stdin und teilt den Datenstrom an jedem Zeilenumbruch in einzelne JSON-RPC-Nachrichten. Beim Senden schreibt er jede Nachricht als eine Zeile nach stdout.
- stdio kennt **keine Session-ID**. Damit der Monitor die Nachrichten trotzdem einer Sitzung zuordnen kann, wird beim Start eine zufällige ID erzeugt (`fallbackSessionId`).
- **Ende der Sitzung:** Bei stdio endet die Verbindung, wenn der Host stdin schließt. Normalerweise würde der Prozess dann von selbst enden. Hier läuft aber noch der Monitor-Webserver, der den Prozess am Leben hielte. Deshalb beendet `process.stdin.once('end', …)` den Prozess ausdrücklich, sonst blieben nach jeder Claude-Code-Sitzung verwaiste Prozesse zurück.

## `src/mcp/http.ts`: Transport Streamable HTTP

**Was die Datei tut:** Startet einen Express-Server mit dem Endpunkt `/mcp` und verwaltet mehrere Sitzungen gleichzeitig.

**Bezug zu MCP:** Diese Datei setzt die Regeln aus [Grundlagen 1.6](01-mcp-grundlagen.md#streamable-http) um:

| HTTP-Anfrage                                              | Verhalten                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `POST` **ohne** `Mcp-Session-Id`, Inhalt ist `initialize` | Neue Sitzung: neuer `NodeStreamableHTTPServerTransport`, neue `McpServer`-Instanz, beide über `TappedTransport` verbunden |
| `POST` **mit** bekannter `Mcp-Session-Id`                 | Nachricht an den Transport dieser Sitzung weitergeben                                                                     |
| `POST` ohne gültige Session und kein `initialize`         | `400` mit JSON-RPC-Fehler `-32000`                                                                                        |
| `GET` mit Session                                         | SSE-Stream öffnen, über den der Server von sich aus Nachrichten schicken kann                                             |
| `DELETE` mit Session                                      | Sitzung beenden                                                                                                           |

Weitere Punkte:

- `sessionIdGenerator: () => randomUUID()`: Der Transport erzeugt die Session-ID und schickt sie im Header `Mcp-Session-Id` zurück.
- `onsessioninitialized`: Erst wenn die ID feststeht, wird der Transport in der Tabelle `transports` gespeichert.
- `onClosed` entfernt die Sitzung wieder aus der Tabelle.
- `createMcpExpressApp()` aus `@modelcontextprotocol/express` bringt bereits einen Schutz gegen **DNS-Rebinding** mit: Anfragen werden nur angenommen, wenn der `Host`-Header auf localhost zeigt. Die MCP-Spezifikation empfiehlt das für lokale Server, weil sonst eine fremde Webseite im Browser den lokalen Server ansprechen könnte.
- Der Server lauscht nur auf `127.0.0.1`, ist also aus dem Netzwerk nicht erreichbar.

## `src/mcp/http.test.ts`

Ein End-to-End-Test: echter MCP-Client mit `StreamableHTTPClientTransport` gegen den echten HTTP-Server, Ports zufällig (`0`). Er prüft, dass die Nachrichten mit `transport: 'http'` gespeichert werden und ein Live-Event über den WebSocket ankommt.

---

## `src/monitor/tappedTransport.ts`

**Was die Datei tut:** Eine Hülle, die nach außen genau wie ein Transport aussieht (`implements Transport`), intern aber einen echten Transport benutzt. Jede Nachricht meldet sie an den Monitor und reicht sie dann unverändert weiter.

**Bezug zu MCP:** Das ist das Herzstück des Mitschnitts. Es nutzt die Schichtung des SDK aus ([Grundlagen 1.7](01-mcp-grundlagen.md#17-die-schichten-des-sdk)):

```text
                 McpServer / Protocol
                   ▲               │
      onmessage()  │               │  send()
                   │               ▼
              ┌─────────────────────────┐
              │    TappedTransport      │──► Monitor.record(…)
              └─────────────────────────┘
                   ▲               │
                   │               ▼
       StdioServerTransport  oder  NodeStreamableHTTPServerTransport
```

- **Eingehend (Client → Server):** Der echte Transport ruft `onmessage` auf. Die Hülle zeichnet die Nachricht als `client->server` auf und gibt sie an das Protokoll weiter.
- **Ausgehend (Server → Client):** Das Protokoll ruft `send()` auf. Die Hülle zeichnet die Nachricht als `server->client` auf und gibt sie an den echten Transport weiter.
- `start()`, `close()`, `sessionId`, `setProtocolVersion()` usw. werden einfach durchgereicht. `setProtocolVersion` ist wichtig für HTTP: Das Protokoll teilt dem Transport darüber die ausgehandelte Version mit, damit er den Header `MCP-Protocol-Version` prüfen kann.

**Vorteile dieser Position:** Der Monitor sieht bei beiden Transporten dieselben, bereits zerlegten JSON-RPC-Nachrichten, und Server-Code wie `createMcpServer.ts` muss vom Mitschnitt nichts wissen.

**Grenze:** HTTP-Details (Statuscodes, Header, SSE) liegen unterhalb dieser Schicht und sind deshalb nicht sichtbar.

**Ausblick:** Weil jede Nachricht durch diese Hülle läuft, wäre sie ein naheliegender Ort für spätere Eingriffe (z. B. Nachrichten verzögern oder anhalten). Ob das so umgesetzt wird, ist noch offen.

## `src/monitor/tappedTransport.test.ts`

Verbindet einen echten Client mit dem Server über `InMemoryTransport`: zwei verbundene Transport-Enden im selben Prozess, ganz ohne stdio oder Netzwerk. Geprüft wird, dass `initialize`, `notifications/initialized` und `tools/call` in der richtigen Richtung aufgezeichnet werden und dass `clientInfo` in der Sitzung landet.

## `src/monitor/classify.ts`

**Was die Datei tut:** Bestimmt für eine Nachricht `kind`, `method` und `rpcId`.

**Bezug zu MCP:** Setzt die JSON-RPC-Regeln aus [Grundlagen 1.3](01-mcp-grundlagen.md#13-json-rpc-20-das-nachrichtenformat) um:

```text
hat method?  ── ja ──► hat id? ── ja ──► request
     │                    └───── nein ──► notification
     nein
     └──► hat error? ── ja ──► error
                └───── nein ──► response
```

## `src/monitor/monitor.ts`

**Was die Datei tut:** Die zentrale Sammelstelle. `record()` klassifiziert die Nachricht, speichert sie und verteilt sie als Ereignis an alle Interessenten (die WebSocket-Verbindungen der Oberfläche).

**Bezug zu MCP:**

- **Sitzungen verfolgen:** Bei der ersten Nachricht einer Session-ID wird eine Sitzung angelegt.
- **Client erkennen:** Ist die Nachricht ein `initialize`-Request, liest der Monitor `params.clientInfo` aus. So weiß die Oberfläche, ob z. B. Claude Code oder der Inspector verbunden ist.
- **Sitzungsende:** `endSession()` wird aufgerufen, wenn der Transport sich schließt.
- **Nie stören:** Fehler beim Aufzeichnen werden nur geloggt. Der MCP-Verkehr läuft in jedem Fall weiter.

## `src/monitor/eventStore.ts`

**Was die Datei tut:** Speichert Events und Sitzungen in SQLite (eingebautes Node-Modul `node:sqlite`).

**Bezug zu MCP:** Die Tabellen bilden die Protokollbegriffe ab:

| Tabelle    | Spalte        | Herkunft im Protokoll                            |
| ---------- | ------------- | ------------------------------------------------ |
| `sessions` | `session_id`  | `Mcp-Session-Id` (HTTP) bzw. erzeugte ID (stdio) |
|            | `transport`   | `stdio` oder `http`                              |
|            | `client_info` | `clientInfo` aus `initialize`                    |
| `events`   | `direction`   | Client → Server oder Server → Client             |
|            | `kind`        | JSON-RPC-Nachrichtenart                          |
|            | `method`      | z. B. `tools/call`                               |
|            | `rpc_id`      | JSON-RPC-`id`; verbindet Request und Response    |
|            | `payload`     | die vollständige Nachricht als JSON              |

Die `rpc_id` wird als JSON gespeichert, weil JSON-RPC sowohl Zahlen als auch Texte als ID erlaubt; so bleiben `1` und `"1"` unterscheidbar.

## `src/monitor/monitorServer.ts`

**Was die Datei tut:** Ein eigener HTTP-Server (Port 3001) für die Oberfläche:

- `GET /api/events`: gespeicherte Events, filterbar nach Sitzung, Methode und ID
- `GET /api/sessions`: Sitzungen
- WebSocket `/ws`: Live-Events an den Browser; Rückkanal für spätere Steuerbefehle
- `/`: die gebaute Oberfläche. Gesucht wird zuerst `web/` neben der laufenden Datei (das ist beim Bundle der Fall, siehe [Kapitel 6](06-konfiguration.md#server-in-anderen-projekten-nutzen-bundle)), dann `packages/web/dist` im Repo.

**Bezug zu MCP:** Dieser Server spricht **kein** MCP. Er ist bewusst vom MCP-Endpunkt getrennt, damit der Beobachtungskanal den beobachteten Verkehr nicht beeinflusst. Er übernimmt aber dieselben Schutzmaßnahmen, die MCP für lokale HTTP-Server empfiehlt: nur `127.0.0.1`, Prüfung des `Host`-Headers und beim WebSocket Prüfung der `Origin`.

---

## `package.json` und `tsconfig.json` des Pakets

| Abhängigkeit                    | Zweck im MCP-Kontext                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `@modelcontextprotocol/server`  | SDK: `McpServer`, Protokoll-Logik, `StdioServerTransport`, Typen |
| `@modelcontextprotocol/node`    | `NodeStreamableHTTPServerTransport` für Node-HTTP                |
| `@modelcontextprotocol/express` | Express-App mit Host-Header-Schutz für MCP                       |
| `@modelcontextprotocol/client`  | (nur Tests) echter MCP-Client als Gegenseite                     |
| `zod`                           | Eingabeschemata der Tools; das SDK macht daraus JSON Schema      |
| `express`, `ws`                 | HTTP-Server und WebSocket für den Monitor                        |

`bin` in der `package.json` macht den gebauten Server als Befehl `mcp-testing-server` verfügbar, so wie viele veröffentlichte MCP-Server per `npx` gestartet werden.
