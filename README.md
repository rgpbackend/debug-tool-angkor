# Game GUI (WebSocket)

Minimal web client for **The Last Guardian of Angkor**: login, launch game, connect over WebSocket, join, spin, and inspect `spin` / `round` / `state` payloads.

## Protocol

See [frontend-backend-websocket-guide.md](docs/frontend-backend-websocket-guide.md) in this repo (wallet balance on join `1005` and spin `1500`; active refresh via client `cmd 1530` GET_BALANCE), or the Confluence guide: [WebSocket Integration Guide of The Last Guardian of Angkor](https://ossworks.atlassian.net/wiki/spaces/YAM/pages/297435300/WebSocket+Integration+Guide+of+The+Last+Guardian+of+Angkor).

Agency REST endpoints are documented in [Luigi WS002.postman_collection.json](docs/Luigi%20WS002.postman_collection.json).

Monetary fields on the wire are **plain decimal strings** with 4 fractional digits (e.g. `"1000.0000"`), not JSON numbers.

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local if needed (defaults target agency001 + gob02 WS)
npm run dev
```

## Login flow

1. `POST {VITE_API_AUTH_URL}/user/login` with username and password → user JWT
2. `POST {VITE_API_AUTH_URL}/play-game` with Bearer user JWT and `{ gameId }` → WS access token (in memory) + `refreshToken` (stored in `localStorage` only)
3. WebSocket connect to `VITE_WS_URL` with WS access token, then join `gameId`

On reload, if a refresh token exists in `localStorage`, the client calls `VITE_AUTH_REFRESH_URL` with that token to obtain `accessToken` + `refreshToken`, then connects the WebSocket. Login and `play-game` are not called again during this path.

While the WebSocket is open:

- Every **30 seconds** the client sends a STOMP heartbeat frame (`["7","MiniGame","1",2]`).
- Every **115 seconds** (configurable via `VITE_AUTH_REFRESH_INTERVAL_MS`) the client calls the same auth refresh endpoint, overwrites the stored refresh token, and sends a reconnect auth frame (`connect` with `reconnect: true` and the new `accessToken`) on the existing socket. Agency `play-game` is not called during this loop.

## Environment variables

| Variable                    | Description                                                                 |
| --------------------------- | --------------------------------------------------------------------------- |
| `VITE_API_AUTH_URL`         | Agency API base (default `https://agency001.relaxwmestu.xyz/api/v1`)        |
| `VITE_WS_URL`               | WebSocket endpoint URL                                                      |
| `VITE_GAME_ID`              | Game id for play-game and WS join (default `game-the-last-guardian-of-angkor`) |
| `VITE_AGENT_ID`             | Agent id for connect frame (default `1`)                                    |
| `VITE_WS_TIMEOUT_MS`        | Spin response timeout in ms (default `10000`)                                 |
| `VITE_AUTH_REFRESH_URL`     | Auth refresh endpoint (`accessToken` + `refreshToken` in response)          |
| `VITE_AUTH_REFRESH_INTERVAL_MS` | Auth refresh interval on open WS in ms (default `115000`)              |

## Scripts

- `npm run dev` — local dev server
- `npm run build` — typecheck + production bundle
- `npm run preview` — preview production build

## CORS / WSS

The browser calls the agency REST API and opens a direct WebSocket to `VITE_WS_URL`. If either blocks unknown origins, configure the server or use infrastructure your environment allows (this app does not add a backend proxy by default).
