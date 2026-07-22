# Game Isolation Architecture

## Goal

Restructure the codebase so each game (Angkor, Titan's Wrath) is a fully independent
module from the moment the user clicks "Play" in the lobby. Changing one game must
never break the other.

## Architecture

```
src/
├── ws/                          # Shared WS infrastructure
│   ├── browser-ws-client.ts     # (unchanged) Raw WebSocket wrapper
│   ├── frames.ts                # (unchanged) Frame builders
│   ├── protocol.ts              # (unchanged) Protocol types & parsers
│   ├── stomp-errors.ts          # (unchanged)
│   ├── game-phase.ts            # (unchanged)
│   └── useWsSession.ts          # ★ NEW: Shared WS lifecycle hook
│
├── api/                         # (unchanged) HTTP client, auth, agency API
│
├── lib/                         # Shared utilities
│   ├── game-session-storage.ts  # (unchanged) localStorage keys
│   ├── ws-session-refresh.ts    # (unchanged)
│   ├── format-bet.ts            # (unchanged)
│   └── ...
│
├── games/                       # ★ Game-specific modules
│   ├── game-the-last-guardian-of-angkor/
│   │   ├── index.ts
│   │   ├── GameScreen.tsx       # Moved from src/screens/GameScreen.tsx
│   │   ├── useGameSession.ts    # Moved & trimmed from src/hooks/useGameSession.ts
│   │   ├── lib/
│   │   │   ├── reel-spin.ts
│   │   │   ├── cheat.ts
│   │   │   ├── celebrations.ts
│   │   │   ├── celebration-timing.ts
│   │   │   ├── round-flow.ts
│   │   │   └── wait-for-spin-ui.ts
│   │   └── components/
│   │       ├── SlotCabinet.tsx
│   │       ├── WinWayReelGrid.tsx
│   │       ├── SlotReelColumn.tsx
│   │       ├── SlotStageBlock.tsx
│   │       ├── SlotControls.tsx
│   │       ├── SlotConsoleBalance.tsx
│   │       ├── SlotCelebrationOverlay.tsx
│   │       ├── BetPickerModal.tsx
│   │       ├── CheatModal.tsx
│   │       ├── CheatReelGridEditor.tsx
│   │       ├── HistoryModal.tsx
│   │       ├── HistoryView.tsx
│   │       ├── JackpotPoolsBar.tsx
│   │       ├── JackpotWinnersModal.tsx
│   │       ├── JackpotWinnersView.tsx
│   │       └── JoinRetryModal.tsx
│   │
│   └── yama_01021/
│       ├── index.ts
│       ├── GameScreen.tsx       # Titan-specific UI (5×3, paylines, Greek theme)
│       ├── useGameSession.ts    # Titan-specific WS operations
│       ├── lib/
│       │   ├── reel-spin.ts     # 5×3 reel logic
│       │   ├── paylines.ts      # 10 payline definitions
│       │   ├── expanding-wild.ts
│       │   ├── titan-multiplier.ts
│       │   └── celebrations.ts
│       └── components/
│           ├── TitanCabinet.tsx
│           ├── PaylineReelGrid.tsx
│           ├── TitanControls.tsx
│           ├── TitanCelebrationOverlay.tsx
│           ├── SuperBetToggle.tsx
│           ├── AutoSpinPicker.tsx
│           ├── ComboOverlay.tsx
│           ├── TokenJackpotBar.tsx
│           ├── TitanHistoryModal.tsx
│           └── TitanJackpotWinnersModal.tsx
│
├── screens/                     # Shared screens
│   ├── LobbyScreen.tsx          # (unchanged)
│   ├── LoginScreen.tsx          # (unchanged)
│   └── RegisterScreen.tsx       # (unchanged)
│
├── hooks/                       # Shared hooks
│   ├── useAutoSpin.ts           # (unchanged) — Angkor uses this
│   ├── useRoundRunner.ts        # (unchanged) — Angkor uses this
│   ├── useSyncRef.ts            # (unchanged)
│   ├── useReelStripMotion.ts    # (unchanged) — Angkor uses this
│
├── App.tsx                      # Routes to game.GameScreen by game.id
├── App.css                      # Shared styles
├── slot-cabinet.css             # Moved into Angkor if Angkor-only
├── games.ts                     # ★ Game registry with component references
├── config.ts                    # (unchanged) Env config
└── main.tsx                     # (unchanged)
```

## Shared WS lifecycle: `useWsSession`

Extracted from `useGameSession` — handles only the WS lifecycle common to all games.
Does NOT handle: spin, cheat, history queries, celebrations, auto-spin, round runner,
or any game-specific WS commands.

```ts
export function useWsSession(
  wsUrl: string,
  gameId: string,
  agentId: string,
  jackpotTierInfo: JackpotTierInfo[],
  timeoutMs: number,
) {
  // Internal: BrowserWsClient, connect/auth/join, heartbeat, session refresh
  // Returns minimal state:

  return {
    phase,               // GamePhase
    sessionReady,        // true after join 1005 succeeded
    error,
    gameScreenActive,    // true after WS connect + auth
    balance,             // string | null
    symbolCatalog,       // GameSymbol[]
    betLevels,           // string[]
    lastRound,           // LastRound | null (from join response)
    jackpotPoolsByTier,  // JackpotPoolsByTier
    jackpotPoolsLoading,
    jackpotWinnersRefreshToken,
    gameRoute,           // string (same as gameId)

    // Operations shared by all games
    clientRef,           // React.RefObject<BrowserWsClient | null>
    joinGame,            // () => Promise<void>
    sendFrame,           // (frame: WsOutboundFrame) => void
    disconnect,          // () => void
    refreshBalance,      // () => Promise<void>
    logout,              // () => void
  };
}
```

## Game registry: `src/games.ts`

```ts
export type GameScreenProps = {
  agencyUserToken: string;
  onBackToLobby: () => void;
  onLogout: () => void;
};

export interface GameDef {
  id: string;
  name: string;
  icon: string;
  agentId: string;
  jackpotTiers: JackpotTierDef[];
  GameScreen: React.ComponentType<GameScreenProps>;
}

import { AngkorGameScreen } from "./games/game-the-last-guardian-of-angkor";
import { TitanGameScreen } from "./games/yama_01021";

const GAMES: GameDef[] = [
  {
    id: "game-the-last-guardian-of-angkor",
    name: "The Last Guardian of Angkor",
    icon: "🏛️",
    agentId: "AGENCY_001",
    jackpotTiers: [...],
    GameScreen: AngkorGameScreen,
  },
  {
    id: "yama_01021",
    name: "Titan's Wrath",
    icon: "⚡",
    agentId: "AGENCY_001",
    jackpotTiers: [...],
    GameScreen: TitanGameScreen,
  },
];
```

## App.tsx routing

Route by `game.id`, not by `winSystem`:

```tsx
{view === "game" && selectedGame ? (
  <selectedGame.GameScreen
    agencyUserToken={session.agencyUserToken}
    onBackToLobby={handleBackToLobby}
    onLogout={handleLogout}
  />
) : ...}
```

Each game module is responsible for its own `useWsSession` invocation inside its
game-specific `useGameSession`. App.tsx has no knowledge of WS internals.

## Data flow

```
App.tsx
  │  handleLaunchGame(game) → playGame API → wsAccessToken
  │  setSelectedGame(game)
  │
  └─ <game.GameScreen
       agencyUserToken={...}
       onBackToLobby={...}
       onLogout={...}
     />

Inside each GameScreen:
  useGameSession(agencyUserToken, defaults)
    ├── useWsSession(wsUrl, gameId, agentId, jackpotTiers, timeoutMs)
    │     → connect → auth → join 1005 → heartbeat → session refresh
    │     → returns sessionReady, balance, symbols, betLevels, ...
    │
    ├── Game-specific logic:
    │     Angkor: spin 1500, cheat 2001, forceJP 2002, history 1502/1503
    │     Titan:  spin 1500, expanding wild handling, token JP collection
    │
    └── Returns game-specific UI props → render game-specific components
```

## Migration plan

### Phase 1: Extract `useWsSession` from `useGameSession`
1. Create `src/ws/useWsSession.ts` with connect/auth/join/heartbeat/refresh logic
2. Does NOT include spin, cheat, history, auto-spin, round runner
3. Keep original `useGameSession` working as before (it will be moved later)

### Phase 2: Create Angkor game module
1. Create `src/games/game-the-last-guardian-of-angkor/` directory
2. Move Angkor-specific files from `src/components/`, `src/hooks/`, `src/lib/`, `src/screens/`
3. Create Angkor `useGameSession` wrapping `useWsSession`
4. Create `src/games/game-the-last-guardian-of-angkor/index.ts`
5. Update `src/games.ts` registry
6. Update `src/App.tsx` to use game component from registry
7. Remove old files, verify Angkor still works

### Phase 3: Create Titan's Wrath game module
1. Create `src/games/yama_01021/` directory with all new components
2. Create Titan `useGameSession` wrapping `useWsSession`
3. Implement Titan-specific UI (5×3 payline grid, controls, animations)
4. Add Titan to game registry

## Titan's Wrath — UI Layout

```
┌────────────────────────────────────────────────┐
│  ← Lobby        Olympus Jackpot              │
│         MINI    MINOR    MAJOR    GRAND       │  ← JackpotPoolsBar
├────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐   │
│  │  ┌─────┬─────┬─────┬─────┬─────┐       │   │
│  │  │     │     │     │     │     │       │   │  ← 5×3 Reel Grid
│  │  │     │     │     │     │     │       │   │     Payline-based
│  │  │     │     │     │     │     │       │   │     Expanding Wild
│  │  └─────┴─────┴─────┴─────┴─────┘       │   │
│  └────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────┐   │
│  │  Win amount / Combo / TITAN WRATH x4   │   │  ← Info display (USP→Win)
│  └────────────────────────────────────────┘   │
├────────────────────────────────────────────────┤
│  Menu  ⚡Fast  [◀ Bet ▶]  Balance    [Spin]  │  ← Console
│         Super Bet [OFF/ON]                    │  ← +50% bet, 2x wild chance
│    Auto: [5] [10] [25] [50] [100] [∞]       │  ← Auto-spin presets
└────────────────────────────────────────────────┘
```

## Titan's Wrath — Feature Summary

| Feature | Notes |
|---|---|
| 5×3 grid, 10 paylines (both-ways) | Column-major reels; win left→right and right→left |
| Expanding Wild + Respin chain | Wild on reels 2,3,4 → expand → sticky → respin → max 3 |
| Titan Multiplier (x2, x3) | 3-4 OAK passing through expanded wild reels |
| Titan's Wrath (x4) | 5 OAK → screen shake + meteor collision animation |
| Token-based Jackpot | Collect 3-6 tokens in same Bet ID Sequence → MINI/MINOR/MAJOR/GRAND |
| Super Bet | Toggle adds 50% to bet, doubles wild probability |
| Combo system | 2-3 lines = COMBO, 4-5 = SUPER COMBO, 6+ = MEGA COMBO |
| Balance display | 7 digits before decimal, 2 zeros after |
| Bet levels | 43 fixed levels, $0.10–$100 |
| Fast spin | Toggle to skip reel animation |
| Auto-spin presets | 5/10/25/50/100/∞ |

## Titan's Wrath — Art Direction

- **Theme:** Dark Greek mythology (Zeus, Poseidon, Hades)
- **Colors:** Dark blue-black stormy sky, gold & neon purple/violet accents
- **Background:** Mount Olympus in storm, cracked marble pillars, golden light
- **Reel frame:** Solid gold + black iron border, swirling clouds behind grid
- **Symbols:** Zeus's Crown, Poseidon's Trident, Aegis Shield, Hades' Helmet, Gold/Ruby/Emerald Runes, Titan's Hammer (WILD)
- **Style:** Semi-cartoon, stylized hand-painted 2D, chunky & glowing assets

## Error handling

- Token banned (STOMP 105): `useWsSession` clears game session, propagates `onTokenBan()` callback
- WS disconnect: `useWsSession` cleans up, propagates error
- Back to Lobby: clean disconnect, no error, return to lobby
- Per-game error display: each game's `GameScreen` handles its own error states

## Not changed

- Login/Register flow
- Agency REST API calls (`login`, `playGame`, `deposit`, `register`, `refreshSessionToken`)
- BrowserWsClient
- Wire protocol types and parsers (protocol.ts)
- Frame builders (frames.ts)
- STOMP error handling
- localStorage keys
- Env config (config.ts)
