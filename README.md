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

## Als stdio-Server einbinden

```bash
npm run build
node packages/server/dist/index.js --transport stdio --monitor-port 3001
```

Die Monitoring-Oberfläche läuft dann unter <http://127.0.0.1:3001> (nach `npm run build` mit ausgelieferter UI).

Optionen: `node packages/server/dist/index.js --help`

## Weitere Doku

- [REQUIREMENTS.md](REQUIREMENTS.md) – Anforderungen
- [CLAUDE.md](CLAUDE.md) – Architektur, Befehle und Konventionen
