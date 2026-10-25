# 5. Shared und Web

## `packages/shared/src/index.ts`: gemeinsame Typen

Dieses Paket enthält nur TypeScript-Typen. Es erzeugt zur Laufzeit keinen Code, sorgt aber dafür, dass Server und Oberfläche dieselbe Vorstellung davon haben, wie ein mitgeschnittenes Event aussieht.

| Typ                 | Bedeutung                                            | Bezug zu MCP                                                                                   |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Direction`         | `'client->server'` oder `'server->client'`           | MCP ist bidirektional: Beide Seiten senden Requests und Notifications                          |
| `TransportKind`     | `'stdio'` oder `'http'`                              | die beiden Standardtransporte                                                                  |
| `MessageKind`       | `request`, `response`, `error`, `notification`       | die JSON-RPC-Nachrichtenarten                                                                  |
| `MonitorEvent`      | eine mitgeschnittene Nachricht                       | `payload` ist die unveränderte JSON-RPC-Nachricht; `method` und `rpcId` sind daraus abgeleitet |
| `SessionInfo`       | eine Verbindung                                      | `clientInfo` stammt aus `initialize`                                                           |
| `ServerToUiMessage` | was der Monitor per WebSocket an den Browser schickt | kein MCP, internes Format                                                                      |
| `UiToServerMessage` | was der Browser an den Monitor schickt               | Platzhalter für spätere Steuerbefehle                                                          |

`payload` hat bewusst den Typ `unknown`: Der Monitor soll auch Nachrichten speichern können, die nicht dem Standard entsprechen. Gerade beim Testen von Clients sind fehlerhafte Nachrichten interessant.

## `packages/web`: die Monitoring-Oberfläche

Die Oberfläche spricht selbst **kein** MCP. Sie zeigt an, was der Monitor zwischen MCP-Client und -Server gesehen hat.

### `src/useMonitor.ts`

- Lädt beim Start die letzten 500 Events (`/api/events`) und alle Sitzungen (`/api/sessions`).
- Öffnet danach einen WebSocket (`/ws`) und hängt jedes neue Event live an.
- Bricht die Verbindung ab (z. B. weil der Server neu startet), verbindet sie sich nach 2 Sekunden neu.

### `src/App.tsx`

Drei Bereiche, die direkt auf MCP-Begriffe abgebildet sind:

| Bereich         | Zeigt                                        | MCP-Bezug                                                                           |
| --------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Links: Sessions | Client-Name, Transport, Startzeit, „beendet“ | eine Zeile pro Client-Server-Verbindung; Name aus `clientInfo`                      |
| Mitte: Tabelle  | Zeit, Richtung, Typ, Methode, ID             | eine Zeile pro JSON-RPC-Nachricht; gleiche **ID** = Request und zugehörige Response |
| Rechts: Details | vollständiges JSON der gewählten Nachricht   | die Nachricht genau so, wie sie übertragen wurde                                    |

Farben: Notifications grau, Protokollfehler (`error`) rot.

**Tipp zum Lernen:** Request und Response einer Anfrage haben dieselbe ID. Ein Klick auf beide nacheinander zeigt, welche Antwort zu welcher Frage gehört. Eine automatische Zuordnung mit Antwortzeit ist als Anforderung FM-8 geplant.

### `vite.config.ts`

Im Entwicklungsmodus läuft die Oberfläche auf Port 5173. Vite leitet `/api` und `/ws` an den Monitor auf Port 3001 weiter, sodass der Browser alles über eine Adresse erreicht.

### `index.html`, `src/main.tsx`, `src/styles.css`

Standard-Einstieg einer React-Anwendung und das Layout. Kein MCP-Bezug.
