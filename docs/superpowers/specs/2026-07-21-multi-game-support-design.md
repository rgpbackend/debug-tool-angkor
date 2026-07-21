# Multi-Game Support Design

## Goal

Restructure the debug-tool-ui (currently single-game for Angkor) to support
multiple games through a lobby → game flow. One login, one agency token, many
games (one at a time — switchable via lobby).

## Current state

- Single-page app: Login → Game Screen (Angkor only)
- `gameId`, `wsUrl`, `agentId` hardcoded in `config.ts` defaults and `.env`
- Storage keys hardcoded: `angkor.gui.refreshToken`, `angkor.gui.agencyUserToken`
- All session state in one 1179-line `useGameSession()` hook

## Target flow

```
Login → Lobby (choose game) → Game Screen (Back to Lobby)
          ↑                        │
          └────────────────────────┘
```

1. User logs in → agency user token stored
2. Lobby shows available games (from static registry)
3. Click game → `POST /play-game` with that `gameId` → WS connect + join
4. "Back to Lobby" button in game → disconnect WS → return to lobby
5. Can pick a different game without re-login

## Design

### 1. New file: `src/games.ts` — Static game registry

```ts
export interface GameDef {
  id: string;        // gameId for play-game API & WS join
  name: string;      // display name
  icon: string;      // emoji
  wsUrl: string;     // WebSocket endpoint for this game
  agentId: string;   // agent id for WS connect frame
}

export const GAMES: GameDef[] = [
  {
    id: "game-the-last-guardian-of-angkor",
    name: "The Last Guardian of Angkor",
    icon: "🏛️",
    wsUrl: "wss://gob02-ws.relaxwmestu.xyz/websocket",
    agentId: "AGENCY_001",
  },
  // Add new games here
];
```

Adding a new game = adding one object to this array.

### 2. New file: `src/screens/LobbyScreen.tsx` — Game selection

- Shows game cards in a grid (name + icon)
- Props: `{ agencyUserToken, onLaunch(token, refreshToken, game), onLogout }`
- Click card → calls `playGame(userToken, game.id)` → passes result up
- Navigate to GameScreen happens in App (parent), not in Lobby

### 3. Modify `src/App.tsx` — Add lobby view

- View type: `"login" | "register" | "lobby" | "game"`
- After successful login → `"lobby"`
- After game launch → `"game"` with selected game's config
- "Back to Lobby" in game → disconnect → `"lobby"`
- Logout from lobby → `"login"`, clear storage

### 4. Modify `src/config.ts` — Remove game-specific defaults

Keep only shared config:
- `apiBaseUrl`
- `authRefreshUrl`
- `authRefreshIntervalMs`
- `timeoutMs`

Remove: `DEFAULT_GAME_ID`, `DEFAULT_WS_URL`, `DEFAULT_AGENT_ID`, `gameId`,
`gameRoute`, `wsUrl`, `agentId` from `GameGuiEnvDefaults`.

### 5. Modify `src/hooks/useGameSession.ts` — Accept game as param

```ts
export function useGameSession(gameId: string, wsUrl: string, agentId: string)
```

No longer reads `gameId`/`wsUrl`/`agentId` from `config.ts`.
Pass them from App when launching a game. All internal refs to `defaults.gameId`,
`defaults.wsUrl`, `defaults.agentId` → use the hook params instead.
`gameRoute` state is initialized from the `gameId` param.

### 6. Modify `src/lib/game-session-storage.ts` — Generic key names

```
"angkor.gui.refreshToken" → "debugtool.gui.refreshToken"
"angkor.gui.agencyUserToken" → "debugtool.gui.agencyUserToken"
```

No game-specific prefix. Refresh token is overwritten each time a new game
is launched (only one active game session at a time per tab).

### Data flow

```
[Login]
  │ POST /user/login → agencyUserToken (saved to storage)
  │
[Lobby]
  │ User clicks game X
  │ POST /play-game { gameId: X.id } (bearer: agencyUserToken)
  │   → wsAccessToken + refreshToken (saved to storage)
  │
[Game Screen]
  │ WS connect(X.wsUrl) + auth + join(X.id)
  │ ... playing ...
  │
[Back to Lobby]
  │ disconnect WS, clear in-memory game state
  │ (agencyUserToken stays → can launch another game)
```

### Error handling

- **Token banned (STOMP error)**: `handleTokenBan()` clears game session,
  returns to login with error message. Same as current behavior.
- **WS disconnect**: `connectionLostLogout()` clears game session, returns to
  login. Same as current behavior.
- **Back to Lobby**: clean disconnect, no error, return to lobby view.
- **Login session expired**: agency token becomes invalid → `playGame` call
  fails → error shown in lobby → user re-logs in.

### Not changed

- All game UI components (SlotCabinet, WinWayReelGrid, etc.)
- WS client (`browser-ws-client.ts`)
- Protocol, frames, cheat, spin, celebration logic
- Register flow
- Auth refresh (periodic WS session refresh) — unchanged
