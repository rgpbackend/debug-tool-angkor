# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # typecheck (tsc -b) + vite build
npm run lint         # eslint .
npm run preview      # build + wrangler dev (Cloudflare preview)
npm run deploy       # build + wrangler deploy (Cloudflare Pages)
```

## Architecture

This is a **multi-game debug/cheat UI** — a React + TypeScript + Vite SPA deployed to Cloudflare Pages. It connects to a backend agency over REST (login, play-game, deposit) and to a game server over raw WebSocket with STOMP-style framing.

### App shell (top-level routing)

`App.tsx` manages four views: `login` → `register` → `lobby` → `game`. The lobby lists available games from `src/games.ts`. Selecting a game calls `POST /play-game` (REST) to get a WS access token, then mounts that game's `GameScreen` component. Back-to-lobby or logout tears down the WS and returns.

### Shared WebSocket layer (`src/ws/`)

- **`browser-ws-client.ts`** — `BrowserWsClient`: wraps native `WebSocket`. Pattern: `waitForPayload(matcher, label)` creates a one-shot promise that resolves when a matching server frame arrives. Persistent listeners dispatch STOMP errors, disconnect events, and inbound payloads to registered handlers.
- **`frames.ts`** — builders for outbound WS frames (connect, join, heartbeat, jackpot pools, get-balance).
- **`protocol.ts`** — shared protocol types (`GameSymbol`, `JoinResponsePayload`, `JackpotPool`, `LastRound`, etc.), parsers, and monetary-value helpers. **All monetary values on the wire are decimal strings with 4 fractional digits** (e.g. `"1000.0000"`).
- **`useWsSession.ts`** — shared WS session hook. Handles connect → join lifecycle, 30s heartbeat, balance refresh (cmd 1530), jackpot pool push/pull (cmd 1510/1520), and join retry. Returns connection phase, balances, symbol catalog, bet levels, jackpot state, and a socket `clientRef`. Each game wraps this hook.
- **`stomp-errors.ts`** — STOMP error code helpers.
- **`game-phase.ts`** — `GamePhase` union type for the session lifecycle.

### REST API layer (`src/api/`)

- **`http.ts`** — `getJson`/`postJson` helpers with bearer token support.
- **`agency.ts`** — login, register, deposit, play-game, fetch-balance endpoints.
- **`auth.ts`** — token refresh endpoint.

### Game registry (`src/games.ts`)

Each game is a `GameDef` with: `id` (server game route), `name`, `icon`, `agentId`, `jackpotTiers` (with `isStatic`/`betMultiplier` for fixed-prize tiers), `winSystem` (`"winways"` | `"paylines"`), and a `GameScreen` component. Add new games here.

### Game implementation pattern (`src/games/<game>/`)

Each game is a self-contained directory with NO cross-game imports (only shared `ws/` layer). Pattern:

```
games/<game>/
  index.ts              # re-exports GameScreen
  GameScreen.tsx         # top-level game screen
  use<Game>Session.ts    # game-specific hook wrapping useWsSession
  <game>-protocol.ts     # game-specific cmd matchers, types, parsers
  <game>-frames.ts       # game-specific outbound frames (spin, etc.)
  <game>-message-parser.ts  # raw WS → { type: "payload" | "stomp-error" }
  hooks/                 # game-specific React hooks (autoSpin, reelMotion, etc.)
  lib/                   # pure functions (spin parsers, reel logic, celebrations)
  components/            # game-specific UI components
  slot-machine.css       # game-specific styles
```

**Existing games:**
- `game-the-last-guardian-of-angkor` — Win-ways slot (6×5 grid). id: `game-the-last-guardian-of-angkor`.
- `titan-wrath` — Paylines slot (5×3 grid, 10 paylines). id: `yama_01021`. Olympus Jackpot with Divine Token mechanic.

### Game session hook pattern

Each game's `use<Game>Session` wraps `useWsSession` and adds game-specific state: `lastSpin`, `isSpinning`, `bet`, `gameError`, etc. It provides a `spin()` function that calls `client.waitForPayload(gameMatcher)` then sends the spin frame, and exposes parsed spin results and derived state.

### Auth & session persistence

On reload, a refresh token in `localStorage` is used to obtain a new WS access token without re-login. While WS is open, auth refresh runs every 115s, sending a reconnect auth frame on the existing socket. See README.md for the full login flow and env vars.

### Key conventions

- Monetary values: decimal strings with 4 fractional digits — never `number`.
- WS frames: STOMP-style arrays, e.g. `[6, "MiniGame", gameRoute, { cmd: "1500", ... }]`.
- Server commands: `1005` (join), `1500` (spin), `1510`/`1520` (jackpot pools), `1521` (jackpot winner), `1530` (balance query), `1501` (balance push), `1502` (jackpot triggered).
- Balance is **seeded AFTER join** completes (see `useWsSession.joinGame`), then refreshed via active cmd `1530`.
- No backend proxy — the browser calls the agency REST API and connects directly to the WS server.
