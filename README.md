# Game GUI (WebSocket)

Minimal web client for **The Last Guardian of Angkor**: connect, join, spin, and inspect `spin` / `round` / `state` payloads from the backend over WebSocket.

## Protocol

See the WebSocket integration guide (v25): [WebSocket Integration Guide of The Last Guardian of Angkor](https://ossworks.atlassian.net/wiki/spaces/YAM/pages/297435300/WebSocket+Integration+Guide+of+The+Last+Guardian+of+Angkor).

Monetary fields on the wire are **plain decimal strings** with 4 fractional digits (e.g. `"1000.0000"`), not JSON numbers.

## Setup

```bash
cd cheat-gui
npm install
cp .env.example .env.local
# Edit .env.local with VITE_WS_URL and VITE_ACCESS_TOKEN (and optional overrides)
npm run dev
```

## Environment variables

| Variable             | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| `VITE_WS_URL`        | WebSocket endpoint URL                                                |
| `VITE_AGENT_ID`      | Agent id for connect frame (default `1`)                              |
| `VITE_ACCESS_TOKEN`  | Access token for connect frame                                        |
| `VITE_GAME_ROUTE`    | Game route segment (default `game-the-last-guardian-of-angkor`)       |
| `VITE_WS_TIMEOUT_MS` | Spin response timeout in ms (default `10000`)                         |

## Scripts

- `npm run dev` — local dev server
- `npm run build` — typecheck + production bundle
- `npm run preview` — preview production build

## CORS / WSS

The browser opens a direct WebSocket to `VITE_WS_URL`. If the server blocks unknown origins, use an endpoint your environment allows, or configure infrastructure accordingly (this app does not add a backend proxy by default).
