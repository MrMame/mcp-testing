# 3. Nachrichtenfluss an echten Beispielen

Alle Nachrichten in diesem Kapitel wurden mit diesem Projekt mitgeschnitten, nicht von Hand geschrieben. Ein Test-Client hat sich per stdio verbunden, die Tools abgefragt, `echo` aufgerufen und danach absichtlich ein Tool aufgerufen, das es nicht gibt.

## 3.1 Initialisierung

**① Client → Server: Request `initialize`**

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {},
    "clientInfo": { "name": "doku-client", "version": "1.0.0" }
  }
}
```

- `id: 0`: Die Antwort wird dieselbe ID tragen.
- `protocolVersion`: die neueste Version, die der Client kann.
- `capabilities: {}`: Dieser Test-Client bietet nichts an (kein Sampling, keine Roots, keine Elicitation). Der Server darf ihn also nichts davon fragen.
- `clientInfo`: Diesen Namen zeigt die Oberfläche in der Sitzungsliste.

**② Server → Client: Response**

```json
{
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": { "tools": { "listChanged": true } },
    "serverInfo": { "name": "mcp-testing", "version": "0.1.0" }
  },
  "jsonrpc": "2.0",
  "id": 0
}
```

- Der Server akzeptiert die Version.
- `capabilities.tools`: Er bietet Tools an. Das SDK hat das automatisch eingetragen, weil in `createMcpServer.ts` ein Tool registriert ist. Resources und Prompts fehlen, weil keine registriert sind.
- `listChanged: true`: Der Server darf melden, wenn sich die Tool-Liste ändert. Das wird später interessant, wenn Tools über die Oberfläche an- und abgeschaltet werden sollen.

**③ Client → Server: Notification `notifications/initialized`**

```json
{ "jsonrpc": "2.0", "method": "notifications/initialized" }
```

Keine `id`, also keine Antwort. Ab jetzt läuft der normale Betrieb.

## 3.2 Tools entdecken

**④ Request `tools/list`** (`"id": 1`, ohne Parameter)

**⑤ Response**

```json
{
  "result": {
    "tools": [
      {
        "name": "echo",
        "title": "Echo",
        "description": "Gibt den übergebenen Text unverändert zurück.",
        "inputSchema": {
          "type": "object",
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "properties": {
            "text": { "type": "string", "description": "Zurückzugebender Text" }
          },
          "required": ["text"]
        }
      }
    ]
  },
  "jsonrpc": "2.0",
  "id": 1
}
```

- `name`: technischer Name, mit dem das Tool aufgerufen wird.
- `title` / `description`: für Menschen und für das Modell. Anhand der Beschreibung entscheidet das Modell, ob es das Tool benutzt.
- `inputSchema`: ein **JSON Schema**. Im Code steht ein Zod-Schema (`z.object({ text: z.string() })`); das SDK wandelt es automatisch in JSON Schema um.

## 3.3 Ein Tool aufrufen

**⑥ Request `tools/call`**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": { "name": "echo", "arguments": { "text": "Hallo MCP" } }
}
```

**⑦ Response**

```json
{
  "result": { "content": [{ "type": "text", "text": "Hallo MCP" }] },
  "jsonrpc": "2.0",
  "id": 2
}
```

Das Ergebnis ist eine Liste von **Content-Blöcken**. Neben `text` gibt es z. B. `image`, `audio` und eingebettete Resources. Optional kann ein Tool zusätzlich `structuredContent` liefern (maschinenlesbare Daten passend zu einem `outputSchema`).

## 3.4 Ein Protokollfehler

**⑧ Request `tools/call` mit unbekanntem Tool** (`"id": 3`, `"name": "gibtsnicht"`)

**⑨ Response mit `error`**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": { "code": -32602, "message": "Tool gibtsnicht not found" }
}
```

Weil das Tool nicht existiert, ist das ein **Protokollfehler** (JSON-RPC-Code `-32602`, ungültige Parameter) und kein `isError`-Ergebnis. In der Oberfläche erscheint diese Zeile rot mit dem Typ `error`.

## 3.5 Derselbe Ablauf über Streamable HTTP

Über HTTP sind die JSON-RPC-Nachrichten **identisch**. Neu ist die HTTP-Hülle drumherum. Mitgeschnitten mit direkten HTTP-Aufrufen:

| Schritt                       | HTTP                           | Status | Wichtige Header in der Antwort                                  | Inhalt der Antwort                    |
| ----------------------------- | ------------------------------ | ------ | --------------------------------------------------------------- | ------------------------------------- |
| `initialize`                  | `POST /mcp`                    | 200    | `mcp-session-id: 09ff77f4-…`, `content-type: text/event-stream` | SSE-Ereignis mit der JSON-RPC-Antwort |
| `notifications/initialized`   | `POST /mcp` + Session-Header   | 202    | –                                                               | leer (Notification, keine Antwort)    |
| `tools/call`                  | `POST /mcp` + Session-Header   | 200    | `content-type: text/event-stream`                               | SSE-Ereignis mit der JSON-RPC-Antwort |
| `tools/list` **ohne** Session | `POST /mcp`                    | 400    | –                                                               | Fehler „Keine gültige Session-ID“     |
| Sitzung beenden               | `DELETE /mcp` + Session-Header | 200    | –                                                               | leer                                  |

So sieht die Antwort auf `tools/call` als SSE-Ereignis aus:

```text
event: message
data: {"result":{"content":[{"type":"text","text":"per HTTP"}]},"jsonrpc":"2.0","id":2}
```

Die Anfragen nach der Initialisierung müssen diese Header mitschicken:

```text
Mcp-Session-Id: 09ff77f4-e529-46ce-bd68-bf2109c71e66
MCP-Protocol-Version: 2025-11-25
Accept: application/json, text/event-stream
```

## 3.6 Was der Monitor sieht und was nicht

Der Monitor zeichnet die **JSON-RPC-Nachrichten** auf (Schritte ①–⑨). HTTP-Details wie Statuscodes, Header oder die SSE-Verpackung sieht er nicht, weil er hinter dem Transport sitzt (siehe [Kapitel 4](04-server.md#srcmonitortappedtransportts)). Ebenfalls nicht sichtbar ist die Anfrage ohne Session: Sie wird von `http.ts` abgewiesen, bevor überhaupt ein Transport existiert.
