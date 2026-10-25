# 1. MCP-Grundlagen

Dieses Kapitel erklärt die Begriffe, die in den anderen Dokumenten vorkommen. Jeder Abschnitt nennt am Ende, wo der Begriff im Projekt auftaucht.

## 1.1 Wozu MCP?

Das **Model Context Protocol** ist ein offenes Protokoll, über das KI-Anwendungen (z. B. Claude Code, Claude Desktop) mit externen Programmen sprechen, die ihnen Werkzeuge, Daten und Vorlagen anbieten. Statt für jede Anwendung eine eigene Schnittstelle zu bauen, implementiert man einmal einen MCP-Server, und jede MCP-fähige Anwendung kann ihn nutzen.

## 1.2 Die drei Rollen

| Rolle      | Aufgabe                                                                                               | Beispiel                      |
| ---------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Host**   | Die Anwendung, mit der ein Mensch arbeitet. Sie startet Clients und entscheidet, was das Modell darf. | Claude Code, Claude Desktop   |
| **Client** | Teil des Hosts. Hält **genau eine** Verbindung zu **einem** Server.                                   | der MCP-Client in Claude Code |
| **Server** | Eigenständiges Programm, das Fähigkeiten anbietet.                                                    | **dieses Projekt**            |

Ein Host kann viele Clients haben (einen pro angebundenem Server). Ein Server weiß nichts vom Modell; er beantwortet nur Anfragen seines Clients.

**Im Projekt:** `mcp-testing` ist ausschließlich ein **Server**. In den Tests spielt ein `Client` aus `@modelcontextprotocol/client` die Gegenseite.

## 1.3 JSON-RPC 2.0: das Nachrichtenformat

Alle MCP-Nachrichten sind JSON-RPC-2.0-Nachrichten. Es gibt drei Arten:

| Art              | Erkennungsmerkmal                      | Erwartet Antwort? | Beispiel                                                 |
| ---------------- | -------------------------------------- | ----------------- | -------------------------------------------------------- |
| **Request**      | hat `method` **und** `id`              | ja                | `{"jsonrpc":"2.0","id":2,"method":"tools/call",…}`       |
| **Response**     | hat `id` und `result` **oder** `error` | –                 | `{"jsonrpc":"2.0","id":2,"result":{…}}`                  |
| **Notification** | hat `method`, aber **keine** `id`      | nein              | `{"jsonrpc":"2.0","method":"notifications/initialized"}` |

Die `id` verbindet eine Antwort mit ihrer Anfrage. Beide Seiten dürfen Requests senden: Nicht nur der Client fragt den Server, auch der Server kann den Client etwas fragen (siehe 1.5).

**Im Projekt:** [`classify.ts`](../packages/server/src/monitor/classify.ts) ordnet jede Nachricht genau nach diesen Regeln ein. Die Spalte „Typ“ in der Oberfläche zeigt das Ergebnis (`request`, `response`, `error`, `notification`).

### Zwei Arten von Fehlern

1. **Protokollfehler:** Eine JSON-RPC-Antwort mit `error` (Code + Nachricht), z. B. wenn ein Tool gar nicht existiert. Codes wie `-32602` (ungültige Parameter) oder `-32601` (Methode unbekannt) stammen aus JSON-RPC.
2. **Fehler bei der Tool-Ausführung:** Eine normale Antwort mit `result`, in der `isError: true` steht. So erfährt das Modell, dass das Tool zwar lief, aber gescheitert ist, und kann darauf reagieren.

## 1.4 Lebenszyklus einer Verbindung

```text
Client                                   Server
  │── initialize (Request) ───────────────►│   Protokollversion + Fähigkeiten des Clients
  │◄────────────────────── Response ───────│   Protokollversion + Fähigkeiten des Servers
  │── notifications/initialized ──────────►│   „Ich bin bereit“
  │                                        │
  │   … Betriebsphase: tools/list, tools/call, ping, Notifications …
  │                                        │
  │── Verbindung beenden ─────────────────►│   stdio: Eingabe schließen · HTTP: DELETE
```

1. **Initialisierung:** Der Client schickt `initialize` mit der gewünschten **Protokollversion** (hier `2025-11-25`), seinen **Fähigkeiten** (Capabilities) und `clientInfo` (Name, Version). Der Server antwortet mit der vereinbarten Version, seinen eigenen Fähigkeiten und `serverInfo`.
2. **Bestätigung:** Der Client sendet die Notification `notifications/initialized`. Erst danach beginnt der normale Betrieb.
3. **Betrieb:** Anfragen und Benachrichtigungen in beide Richtungen.
4. **Ende:** Je nach Transport (siehe 1.6).

**Im Projekt:** Der [`Monitor`](../packages/server/src/monitor/monitor.ts) liest `clientInfo` aus dem `initialize`-Request und zeigt so in der Oberfläche, welcher Client verbunden ist. Kapitel [3](03-nachrichtenfluss.md) zeigt diesen Ablauf mit echten Nachrichten.

## 1.5 Fähigkeiten (Capabilities) und Primitive

Bei der Initialisierung erklären beide Seiten, was sie können. Nur angekündigte Funktionen dürfen genutzt werden.

### Was ein Server anbieten kann

| Primitiv      | Gesteuert von | Bedeutung                                                         | Wichtige Methoden                  |
| ------------- | ------------- | ----------------------------------------------------------------- | ---------------------------------- |
| **Tools**     | Modell        | Funktionen, die das Modell aufrufen kann (Aktionen, Berechnungen) | `tools/list`, `tools/call`         |
| **Resources** | Anwendung     | Daten, die als Kontext gelesen werden (Dateien, Datensätze)       | `resources/list`, `resources/read` |
| **Prompts**   | Mensch        | Vorlagen, die der Mensch z. B. als Slash-Befehl auswählt          | `prompts/list`, `prompts/get`      |

Ändert sich eine Liste zur Laufzeit, kann der Server das mit einer Notification melden, z. B. `notifications/tools/list_changed`, falls er `listChanged: true` angekündigt hat.

### Was ein Client anbieten kann (Server fragt Client)

| Fähigkeit       | Bedeutung                                                     | Methode                  |
| --------------- | ------------------------------------------------------------- | ------------------------ |
| **Sampling**    | Server bittet den Host, das Modell etwas generieren zu lassen | `sampling/createMessage` |
| **Elicitation** | Server bittet den Menschen um eine Eingabe                    | `elicitation/create`     |
| **Roots**       | Server fragt, welche Verzeichnisse er nutzen darf             | `roots/list`             |

### Hilfsfunktionen

`ping` (Verbindung prüfen), `notifications/progress` (Fortschritt), `notifications/cancelled` (Abbruch), `notifications/message` (Log-Meldungen des Servers an den Client).

**Im Projekt:** Aktuell bietet der Server nur das Tool `echo` an ([`createMcpServer.ts`](../packages/server/src/mcp/createMcpServer.ts)). Er kündigt deshalb nur `tools` an. Welche weiteren Primitive dazukommen, ist in der [REQUIREMENTS.md](../REQUIREMENTS.md) noch offen.

## 1.6 Transporte: wie die Nachrichten übertragen werden

JSON-RPC legt nur das **Format** fest. Wie die Bytes übertragen werden, bestimmt der **Transport**. MCP definiert zwei Standardtransporte, beide unterstützt dieses Projekt.

### stdio

- Der Host **startet den Server als Kindprozess**.
- Client → Server über die Standardeingabe (stdin), Server → Client über die Standardausgabe (stdout).
- **Eine JSON-Nachricht pro Zeile**, getrennt durch einen Zeilenumbruch.
- stdout gehört allein dem Protokoll. Jede andere Ausgabe dort (z. B. ein `console.log`) zerstört die Verbindung. Logs gehören nach stderr.
- Es gibt genau eine Sitzung pro Prozess; sie endet, wenn der Host die Eingabe schließt oder den Prozess beendet.

### Streamable HTTP

- Der Server läuft **eigenständig** und bietet **einen** HTTP-Endpunkt an (hier `/mcp`).
- **POST:** Der Client schickt eine Nachricht. Für Requests antwortet der Server entweder mit JSON oder mit einem **SSE-Stream** (Server-Sent Events). Über diesen Stream kann der Server vor der eigentlichen Antwort noch weitere Nachrichten senden, z. B. Fortschrittsmeldungen. Notifications quittiert er nur mit `202 Accepted`.
- **GET:** Öffnet einen SSE-Stream, über den der Server von sich aus Nachrichten an den Client schicken kann.
- **DELETE:** Beendet die Sitzung.
- **Sitzungen:** Der Server vergibt bei der Initialisierung eine ID im Header `Mcp-Session-Id`. Der Client muss sie bei jeder weiteren Anfrage mitschicken, ebenso den Header `MCP-Protocol-Version`.
- Ein Server kann **viele Clients gleichzeitig** bedienen.

**Im Projekt:** [`stdio.ts`](../packages/server/src/mcp/stdio.ts) und [`http.ts`](../packages/server/src/mcp/http.ts) richten die beiden Transporte ein. Der Monitor sitzt **zwischen** Transport und Protokoll-Logik und sieht dadurch bei beiden Transporten dieselben JSON-RPC-Nachrichten (Details in Kapitel [4](04-server.md)).

## 1.7 Die Schichten des SDK

Das Projekt nutzt das offizielle **MCP TypeScript SDK v2**. Es trennt drei Schichten:

```text
┌────────────────────────────────────────────┐
│ McpServer         registerTool(), …        │  „Was bietet der Server an?“
├────────────────────────────────────────────┤
│ Protocol          Requests ↔ Responses,    │  „Welche Antwort gehört zu welcher
│                   Fähigkeiten, Timeouts    │   Anfrage? Ist die Methode erlaubt?“
├────────────────────────────────────────────┤
│ Transport         start(), send(),         │  „Wie kommen die Nachrichten an?“
│                   onmessage, close()       │
└────────────────────────────────────────────┘
```

Die Transport-Schnittstelle ist bewusst schmal: Sie kennt nur ganze JSON-RPC-Nachrichten. Genau an dieser Stelle hängt sich das Projekt ein.
