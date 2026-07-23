# Titan's Wrath — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build core gameplay for Titan's Wrath — 5×3 slot, 10 paylines, Titan Wild + Respin chain, Super Bet toggle. New game folder `src/games/titan-wrath/`, independent from Angkor.

**Architecture:** Titan reuses the shared WS layer (`useWsSession`, frames, protocol) but defines its own protocol types (CMD 1005 & 1500 only), session hook, and all UI components. Money is `double` on wire, `patternGrid` is 15-char row-major string.

**Tech Stack:** React 19, TypeScript 6, Vite 8, plain CSS (no CSS-in-JS), Cinzel Google Font.

## Global Constraints

- Only CMD 1005 (JOIN) and 1500 (SPIN) defined in Titan protocol
- Game route: `yama_01021`, zone: `MiniGame`
- Money on wire: `double` (floating point), not decimal strings
- `patternGrid`: 15-character row-major string, NOT `string[][]`
- Error format: `{ cmd, c, mgs, gid }` — key off `c` (1300–1315), not `mgs`
- Win system: `"paylines"` — registered in GameDef
- No shared Angkor components reused — Titan is fully self-contained
- No new npm packages — Cinzel via `<link>` in `index.html`
- CSS: plain `.css` file, no CSS-in-JS
- Round states: `ACTIVE` | `RESPIN` | `ENDED` — server-driven, no client `isFinished`
- Bet amounts displayed as dollars ($0.10–$100.00)

---

### Task 1: Scaffold folder, register game, add font

**Files:**
- Create: `src/games/titan-wrath/index.ts`
- Modify: `src/games.ts:46`
- Modify: `index.html:7`

**Produces:** `TitanGameScreen` importable, Cinzel font loaded, game in lobby list.

- [ ] **Step 1: Create scaffold index.ts**

```typescript
export { default as GameScreen } from "./GameScreen";
```

- [ ] **Step 2: Register Titan in games.ts**

Add after Angkor entry (line 45):

```typescript
  {
    id: "titan-wrath",
    name: "Titan's Wrath",
    icon: "⚡",
    agentId: "AGENCY_001",
    winSystem: "paylines",
    jackpotTiers: [
      { key: "MINI", label: "MINI", isStatic: false },
      { key: "MINOR", label: "MINOR", isStatic: false },
      { key: "MAJOR", label: "MAJOR", isStatic: false },
      { key: "GRAND", label: "GRAND", isStatic: false },
    ],
    GameScreen: TitanGameScreen,
  },
```

And update the import at top:

```typescript
import { GameScreen as TitanGameScreen } from "./games/titan-wrath";
```

- [ ] **Step 3: Add Cinzel Google Font to index.html**

Add after `<meta name="viewport" ...>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 4: Commit**

```bash
git add src/games/titan-wrath/index.ts src/games.ts index.html
git commit -m "feat: scaffold Titan's Wrath game registration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Titan protocol types, parsers, and matchers

**Files:**
- Create: `src/games/titan-wrath/titan-protocol.ts`
- Create: `src/games/titan-wrath/titan-frames.ts`
- Create: `src/games/titan-wrath/titan-message-parser.ts`

**Consumes:** `hasCmd` from `../../../ws/protocol`, `ParseMessageFn` from `../../../ws/browser-ws-client`, `WsOutboundFrame` from `../../../ws/protocol`, `parseStompErrorCode` from `../../../ws/stomp-errors`

**Produces:**
- `TitanSpinPayload` type
- `TitanPaylineWin` type
- `TitanJoinPayload` type
- `isTitanSpinResponse(payload)` → boolean
- `isTitanSpinError(payload)` → boolean
- `parseTitanSpinPayload(payload)` → TitanSpinPayload
- `parsePatternGrid(str)` → string[5][3]
- `titanSpinFrame(gameRoute, betAmount, superBet)` → WsOutboundFrame
- `parseTitanMessage` → ParseMessageFn
- `formatTitanError(c, mgs)` → string

- [ ] **Step 1: Write titan-protocol.ts**

```typescript
/**
 * Titan's Wrath — protocol types, parsers, and matchers.
 * Only CMD 1005 (JOIN) and 1500 (SPIN) are defined here.
 */
import { hasCmd } from "../../../ws/protocol";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TitanPaylineWin {
  paylineId: string;   // "P01"–"P10"
  symbol: string;
  count: number;       // 3, 4, or 5
  winAmount: number;
  direction: "LTR" | "RTL";
}

export interface TitanWildSpinInfo {
  triggered: boolean;
  wildReels: number[];  // 0-based column indices with new wilds
}

export interface TitanWildState {
  active: boolean;
  spinCount: number;
  lockedReels: number[];  // all locked columns (0-based)
}

export interface TitanSpinPayload {
  cmd: 1500;
  c: number;
  spin: {
    spinType: "BASE" | "RESPIN";
    spinIndex: number;
    patternGrid: string;
    winAmount: number;
    paylineWins: TitanPaylineWin[];
    superBet: boolean;
    baseBet: number;
    titanWild?: TitanWildSpinInfo;
  };
  round: {
    roundId: string;
    state: "ACTIVE" | "RESPIN" | "ENDED";
    betAmount: number;
    totalWin: number;
  };
  state: {
    titanWild: TitanWildState;
  };
}

// ---------------------------------------------------------------------------
// Grid parser
// ---------------------------------------------------------------------------

export function parsePatternGrid(patternGrid: string): string[][] {
  const cols = 5, rows = 3;
  const grid: string[][] = Array.from({ length: cols }, () => []);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      grid[c][r] = patternGrid[r * cols + c] ?? "";
  return grid; // grid[col][row], row: 0=top, 1=mid, 2=bottom
}

// ---------------------------------------------------------------------------
// Spin matchers (cmd 1500)
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isTitanSpinResponse(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1500")) return false;
  if (typeof payload.c !== "number" || payload.c !== 0) return false;
  if (!isObject(payload.spin)) return false;
  if (!isObject(payload.round)) return false;
  if (!isObject(payload.state)) return false;
  const spin = payload.spin as Record<string, unknown>;
  return typeof spin.patternGrid === "string";
}

export function isTitanSpinError(
  payload: Record<string, unknown>,
): boolean {
  return hasCmd(payload, "1500") && payload.c !== 0;
}

// ---------------------------------------------------------------------------
// Spin parser
// ---------------------------------------------------------------------------

function parsePaylineWin(raw: unknown): TitanPaylineWin | null {
  if (!isObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.paylineId !== "string") return null;
  if (typeof r.symbol !== "string") return null;
  if (typeof r.count !== "number") return null;
  const dir = r.direction;
  if (dir !== "LTR" && dir !== "RTL") return null;
  return {
    paylineId: r.paylineId,
    symbol: r.symbol,
    count: r.count,
    winAmount: typeof r.winAmount === "number" ? r.winAmount : 0,
    direction: dir,
  };
}

function parseTitanWildSpin(raw: unknown): TitanWildSpinInfo | undefined {
  if (!isObject(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.triggered !== true) return undefined;
  const wildReels: number[] = [];
  if (Array.isArray(r.wildReels)) {
    for (const v of r.wildReels) {
      if (typeof v === "number") wildReels.push(v);
    }
  }
  return { triggered: true, wildReels };
}

function parseTitanWildState(raw: unknown): TitanWildState {
  if (!isObject(raw)) return { active: false, spinCount: 0, lockedReels: [] };
  const r = raw as Record<string, unknown>;
  const lockedReels: number[] = [];
  if (Array.isArray(r.lockedReels)) {
    for (const v of r.lockedReels) {
      if (typeof v === "number") lockedReels.push(v);
    }
  }
  return {
    active: Boolean(r.active),
    spinCount: typeof r.spinCount === "number" ? r.spinCount : 0,
    lockedReels,
  };
}

export function parseTitanSpinPayload(
  payload: Record<string, unknown>,
): TitanSpinPayload {
  const spin = (payload.spin ?? {}) as Record<string, unknown>;
  const round = (payload.round ?? {}) as Record<string, unknown>;
  const state = (payload.state ?? {}) as Record<string, unknown>;
  const rawWins = Array.isArray(spin.paylineWins) ? spin.paylineWins : [];
  const paylineWins: TitanPaylineWin[] = [];
  for (const entry of rawWins) {
    const win = parsePaylineWin(entry);
    if (win) paylineWins.push(win);
  }
  return {
    cmd: 1500,
    c: 0,
    spin: {
      spinType: (spin.spinType === "RESPIN" ? "RESPIN" : "BASE") as "BASE" | "RESPIN",
      spinIndex: typeof spin.spinIndex === "number" ? spin.spinIndex : 0,
      patternGrid: typeof spin.patternGrid === "string" ? spin.patternGrid : "",
      winAmount: typeof spin.winAmount === "number" ? spin.winAmount : 0,
      paylineWins,
      superBet: Boolean(spin.superBet),
      baseBet: typeof spin.baseBet === "number" ? spin.baseBet : 0,
      ...(spin.titanWild ? { titanWild: parseTitanWildSpin(spin.titanWild) } : {}),
    },
    round: {
      roundId: String(round.roundId ?? ""),
      state: (round.state === "RESPIN" ? "RESPIN" : round.state === "ENDED" ? "ENDED" : "ACTIVE") as "ACTIVE" | "RESPIN" | "ENDED",
      betAmount: typeof round.betAmount === "number" ? round.betAmount : 0,
      totalWin: typeof round.totalWin === "number" ? round.totalWin : 0,
    },
    state: {
      titanWild: parseTitanWildState(state.titanWild),
    },
  };
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

const TITAN_ERROR_MAP: Record<number, string> = {
  1300: "Server error. Please try again.",
  1301: "Unsupported command.",
  1302: "Invalid request. Check your inputs.",
  1305: "Session expired. Reconnecting…",
  1307: "Insufficient balance. Deposit to continue.",
  1308: "Round not found. Starting new round.",
  1309: "Round already ended. Spin again.",
  1310: "Spin in progress. Please wait…",
  1311: "Invalid bet amount.",
  1312: "Session out of sync. Reconnecting…",
};

export function formatTitanError(c: number, mgs?: string): string {
  return TITAN_ERROR_MAP[c] ?? (mgs ? `${mgs} (code ${c})` : `Error code ${c}`);
}

export function isTitanRespinPending(payload: TitanSpinPayload): boolean {
  return payload.round.state === "RESPIN";
}

export function isTitanRoundEnded(payload: TitanSpinPayload): boolean {
  return payload.round.state === "ENDED";
}

// ---------------------------------------------------------------------------
// Combo threshold helper
// ---------------------------------------------------------------------------

export function getComboLevel(count: number): "COMBO" | "SUPER_COMBO" | "MEGA_COMBO" | null {
  if (count >= 6) return "MEGA_COMBO";
  if (count >= 4) return "SUPER_COMBO";
  if (count >= 2) return "COMBO";
  return null;
}
```

- [ ] **Step 2: Write titan-frames.ts**

```typescript
import type { WsOutboundFrame } from "../../../ws/protocol";

const TITAN_ROUTE = "yama_01021";

export function titanSpinFrame(
  betAmount: number,
  superBet: boolean,
): WsOutboundFrame {
  return [6, "MiniGame", TITAN_ROUTE, { cmd: 1500, betAmount, superBet }];
}
```

- [ ] **Step 3: Write titan-message-parser.ts**

```typescript
import { parseStompErrorCode } from "../../../ws/stomp-errors";
import type { ParseMessageFn } from "../../../ws/browser-ws-client";

export const parseTitanMessage: ParseMessageFn = async (raw) => {
  try {
    const text = typeof raw === "string" ? raw : await raw.text();
    const parsed: unknown = JSON.parse(text);
    const stompCode = parseStompErrorCode(parsed);
    if (stompCode !== null) return { type: "stomp-error", code: stompCode };

    if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === "number") {
      const payload = parsed.at(-1);
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return { type: "payload", payload: payload as Record<string, unknown> };
      }
    }
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const p = parsed as Record<string, unknown>;
      if (p.cmd !== undefined) {
        return { type: "payload", payload: p };
      }
    }
    return null;
  } catch {
    return null;
  }
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty src/games/titan-wrath/titan-protocol.ts src/games/titan-wrath/titan-frames.ts src/games/titan-wrath/titan-message-parser.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/games/titan-wrath/titan-protocol.ts src/games/titan-wrath/titan-frames.ts src/games/titan-wrath/titan-message-parser.ts
git commit -m "feat: Titan protocol types, parsers, frames (CMD 1005, 1500 only)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Titan session hook (useTitanSession)

**Files:**
- Create: `src/games/titan-wrath/useTitanSession.ts`

**Consumes:**
- `useWsSession`, `WsSessionCallbacks` from `../../ws/useWsSession`
- `parseTitanMessage` from `./titan-message-parser`
- `isTitanSpinResponse`, `isTitanSpinError`, `parseTitanSpinPayload`, `formatTitanError`, `isTitanRespinPending`, `isTitanRoundEnded`, `parsePatternGrid`, type `TitanSpinPayload` from `./titan-protocol`
- `titanSpinFrame` from `./titan-frames`
- `readTopLevelBalance`, `parseJackpotPoolsFromPayload`, type `JackpotTierInfo` from `../../ws/protocol`

**Produces:**
- `useTitanSession(...)` hook returning: `phase, sessionReady, joinGame, error, bet, setBet, betLevels, balance, selectBetValue, spin, canSpin, isSpinning, lastSpin, viewSpin, lockedReels, superBetActive, setSuperBetActive, respinPending, comboLevel, paylineWins, totalWin`

- [ ] **Step 1: Write useTitanSession.ts**

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWsSession, type WsSessionCallbacks } from "../../ws/useWsSession";
import { parseTitanMessage } from "./titan-message-parser";
import {
  isTitanSpinResponse,
  isTitanSpinError,
  parseTitanSpinPayload,
  formatTitanError,
  isTitanRespinPending,
  isTitanRoundEnded,
  parsePatternGrid,
  getComboLevel,
  type TitanSpinPayload,
} from "./titan-protocol";
import { titanSpinFrame } from "./titan-frames";
import {
  parseJackpotPoolsFromPayload,
  readTopLevelBalance,
  type JackpotTierInfo,
} from "../../ws/protocol";

const WS_CONNECTION_LOST_RE =
  /timeout|WS closed|WS connect error|not connected|Disconnected before|Disconnected after/i;

function isWsConnectionLost(msg: string): boolean {
  return WS_CONNECTION_LOST_RE.test(msg);
}

const TITAN_JACKPOT_TIERS: JackpotTierInfo[] = [
  { key: "MINI", isStatic: false },
  { key: "MINOR", isStatic: false },
  { key: "MAJOR", isStatic: false },
  { key: "GRAND", isStatic: false },
];

export function useTitanSession(
  wsUrl: string,
  wsAccessToken: string,
  callbacks: WsSessionCallbacks,
) {
  const ws = useWsSession(
    wsUrl,
    "titan-wrath",
    "AGENCY_001",
    TITAN_JACKPOT_TIERS,
    wsAccessToken,
    callbacks,
    parseTitanMessage,
  );

  // --- titan-specific state ---
  const [bet, setBet] = useState<string>("0.10");
  const [lastSpin, setLastSpin] = useState<TitanSpinPayload | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [superBetActive, setSuperBetActive] = useState(false);
  const spinBusyRef = useRef(false);

  const error = gameError || ws.error;

  // --- resolve bet from join betLevels ---
  useEffect(() => {
    if (ws.betLevels.length > 0 && !ws.betLevels.includes(bet)) {
      setBet(ws.betLevels[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.betLevels]);

  // --- derived ---
  const betLocked = useMemo(() => {
    return lastSpin !== null && !isTitanRoundEnded(lastSpin);
  }, [lastSpin]);

  const activeBet = betLocked ? String(lastSpin?.round.betAmount ?? bet) : bet;

  const selectBetValue = ws.betLevels.length > 0 ? activeBet : "0.10";

  const canSpin =
    ws.phase === "joined" && ws.sessionReady && ws.betLevels.length > 0 && !spinBusyRef.current;

  // --- spin ---
  const spin = useCallback(async (): Promise<TitanSpinPayload | null> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady || spinBusyRef.current) {
      return null;
    }
    setGameError(null);
    spinBusyRef.current = true;
    setIsSpinning(true);
    try {
      const payloadPromise = client.waitForPayload(isTitanSpinResponse, "titan spin", {
        rejectMatcher: isTitanSpinError,
      });
      const betNum = Number(selectBetValue);
      client.sendFrame(titanSpinFrame(Number.isFinite(betNum) ? betNum : 0.1, superBetActive));
      const raw = await payloadPromise;
      const parsed = parseTitanSpinPayload(raw);
      setIsSpinning(false);

      const bal = readTopLevelBalance(raw);
      if (bal) ws.setBalance(bal);

      setLastSpin(parsed);

      const poolsFromSpin = parseJackpotPoolsFromPayload(raw);
      if (poolsFromSpin) ws.applyJackpotPools(poolsFromSpin);
      else void ws.fetchJackpotPools();

      spinBusyRef.current = false;
      return parsed;
    } catch (e) {
      setIsSpinning(false);
      spinBusyRef.current = false;
      const msg = e instanceof Error ? e.message : String(e);
      if (!client.isConnected() || isWsConnectionLost(msg)) {
        callbacks.onConnectionLost(msg);
      } else {
        // Try to extract error code from error payload
        setGameError(msg);
      }
      return null;
    }
  }, [selectBetValue, superBetActive, ws, callbacks]);

  // --- resolve error from spin error payload ---
  // We need to intercept spin errors in a listener for proper error formatting.
  // The spin function above catches via waitForPayload rejectMatcher.
  // We add a persistent listener for spin errors that arrive as pushes.
  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client) return;
    const cleanup = client.addPayloadListener((payload) => {
      if (isTitanSpinError(payload)) {
        const c = typeof payload.c === "number" ? payload.c : 0;
        const mgs = typeof payload.mgs === "string" ? payload.mgs : undefined;
        const msg = formatTitanError(c, mgs);
        setGameError(msg);
        setIsSpinning(false);
        spinBusyRef.current = false;
        // Auto-retry for lock errors
        if (c === 1310) {
          window.setTimeout(() => { /* user can retry manually */ }, 500);
        }
        // Auto re-join for session/state errors
        if (c === 1305 || c === 1312) {
          void ws.joinGame();
        }
      }
    }, false);
    return cleanup;
  }, [ws.clientRef, ws.joinGame]);

  // --- view state ---
  const viewSpin = lastSpin;

  const lockedReels = viewSpin?.state?.titanWild?.lockedReels ?? [];
  const respinPending = viewSpin ? isTitanRespinPending(viewSpin) : false;
  const paylineWins = viewSpin?.spin?.paylineWins ?? [];
  const totalWin = viewSpin?.round?.totalWin ?? 0;

  const comboLevel = useMemo(() => {
    if (isSpinning) return null;
    return paylineWins.length > 0 ? getComboLevel(paylineWins.length) : null;
  }, [isSpinning, paylineWins.length]);

  // Super Bet can only toggle when not in an active round
  const superBetToggleable = !betLocked;

  return {
    // from ws
    phase: ws.phase,
    sessionReady: ws.sessionReady,
    gameScreenActive: ws.gameScreenActive,
    joinGame: ws.joinGame,
    error,
    balance: ws.balance,
    betLevels: ws.betLevels,
    symbolCatalog: ws.symbolCatalog,
    serverPaylines: ws.serverPaylines,
    jackpotPoolsByTier: ws.jackpotPoolsByTier,
    jackpotPoolsLoading: ws.jackpotPoolsLoading,
    // titan-specific
    bet, setBet,
    selectBetValue,
    betLocked,
    spin, canSpin,
    isSpinning,
    lastSpin,
    viewSpin,
    lockedReels,
    superBetActive,
    setSuperBetActive: (v: boolean) => { if (superBetToggleable) setSuperBetActive(v); },
    superBetToggleable,
    respinPending,
    comboLevel,
    paylineWins,
    totalWin,
    gameError,
    setGameError,
  };
}

export type TitanSession = ReturnType<typeof useTitanSession>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 3: Commit**

```bash
git add src/games/titan-wrath/useTitanSession.ts
git commit -m "feat: Titan session hook — spin, respin chain, super bet state

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: TitanReelGrid — 5×3 reel display

**Files:**
- Create: `src/games/titan-wrath/components/TitanReelGrid.tsx`
- Create: `src/games/titan-wrath/slot-machine.css` (initial, grid + symbol styles only)

**Consumes:** `parsePatternGrid` from `../titan-protocol`

**Produces:** `<TitanReelGrid>` component rendering 5×3 grid with symbol styling, spin animation, locked reel glow.

- [ ] **Step 1: Write TitanReelGrid.tsx**

```typescript
import { useMemo } from "react";
import { parsePatternGrid } from "../titan-protocol";

interface TitanReelGridProps {
  patternGrid: string;
  lockedReels: number[];
  spinning: boolean;
  spinIndex: number; // increments each spin to trigger animation
}

const SYMBOL_CLASS: Record<string, string> = {
  A: "symbol-high",
  B: "symbol-high",
  C: "symbol-mid",
  D: "symbol-mid",
  E: "symbol-mid",
  F: "symbol-low",
  G: "symbol-low",
  W: "symbol-wild",
};

const COLS = 5;
const ROWS = 3;

export default function TitanReelGrid({
  patternGrid,
  lockedReels,
  spinning,
  spinIndex,
}: TitanReelGridProps) {
  const grid = useMemo(() => parsePatternGrid(patternGrid), [patternGrid]);

  return (
    <div className="titan-reel-grid" data-spinning={spinning ? "" : undefined}>
      {Array.from({ length: COLS }).map((_, col) => {
        const isLocked = lockedReels.includes(col);
        const delay = spinning ? `${col * 0.12}s` : "0s";
        return (
          <div
            key={`${spinIndex}-${col}`}
            className={`titan-reel-col${isLocked ? " reel-locked" : ""}${spinning ? " reel-spinning" : ""}`}
            style={{ animationDelay: delay }}
          >
            {Array.from({ length: ROWS }).map((_, row) => {
              const sym = grid[col]?.[row] ?? "";
              return (
                <div key={row} className={`titan-symbol-cell ${SYMBOL_CLASS[sym] ?? ""}`}>
                  <span className="titan-symbol-text">{sym}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write CSS (grid + symbols portion of slot-machine.css)**

```css
/* ============================================================
   Titan's Wrath — Slot Machine Styles
   ============================================================ */

/* --- Design Tokens --- */
:root {
  --titan-obsidian: #0D0B0F;
  --titan-ember: #1A1410;
  --titan-forge-gold: #D4A843;
  --titan-wrath-vermilion: #E8452D;
  --titan-divine-amber: #F0C060;
  --titan-ash: #8A8580;
  --titan-smoke: #C4BFB8;
  --titan-display: 'Cinzel', serif;
  --titan-body: Inter, system-ui, -apple-system, sans-serif;
}

/* --- Reel Grid --- */
.titan-reel-grid {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 12px;
  background: var(--titan-obsidian);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.titan-reel-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: 6px;
  padding: 4px;
  transition: box-shadow 0.3s ease;
}

.titan-reel-col.reel-locked {
  box-shadow: 0 0 12px var(--titan-divine-amber), inset 0 0 8px rgba(240, 192, 96, 0.2);
  animation: locked-pulse 2s ease-in-out infinite;
}

.titan-reel-col.reel-spinning {
  animation: reel-drop 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

@keyframes reel-drop {
  0% { transform: translateY(-30px); opacity: 0; filter: blur(4px); }
  100% { transform: translateY(0); opacity: 1; filter: blur(0); }
}

@keyframes locked-pulse {
  0%, 100% { box-shadow: 0 0 12px var(--titan-divine-amber), inset 0 0 8px rgba(240, 192, 96, 0.2); }
  50% { box-shadow: 0 0 20px var(--titan-divine-amber), inset 0 0 14px rgba(240, 192, 96, 0.35); }
}

/* --- Symbol Cells --- */
.titan-symbol-cell {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--titan-ember);
  border: 1px solid rgba(138, 133, 128, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.titan-symbol-text {
  font-family: var(--titan-display);
  font-size: 1.5rem;
  font-weight: 700;
  user-select: none;
}

.symbol-high .titan-symbol-text { color: var(--titan-forge-gold); }
.symbol-mid .titan-symbol-text { color: #B8B0A0; }
.symbol-low .titan-symbol-text { color: #A08060; }
.symbol-wild .titan-symbol-text {
  color: var(--titan-wrath-vermilion);
  text-shadow: 0 0 10px var(--titan-wrath-vermilion);
  animation: wild-flicker 0.5s ease-in-out infinite alternate;
}

@keyframes wild-flicker {
  0% { text-shadow: 0 0 6px var(--titan-wrath-vermilion); }
  100% { text-shadow: 0 0 16px var(--titan-wrath-vermilion), 0 0 24px var(--titan-forge-gold); }
}

.symbol-wild {
  background: linear-gradient(135deg, rgba(232, 69, 45, 0.15), rgba(212, 168, 67, 0.1));
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 4: Commit**

```bash
git add src/games/titan-wrath/components/TitanReelGrid.tsx src/games/titan-wrath/slot-machine.css
git commit -m "feat: TitanReelGrid — 5x3 grid from patternGrid, symbol tiers, spin animation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: TitanPaylineOverlay — SVG payline visualization

**Files:**
- Create: `src/games/titan-wrath/components/TitanPaylineOverlay.tsx`

**Consumes:** `TitanPaylineWin` from `../titan-protocol`, `ServerPayline` from `../../../ws/protocol`

**Produces:** `<TitanPaylineOverlay>` SVG overlay showing 10 payline paths + winning highlights.

- [ ] **Step 1: Write TitanPaylineOverlay.tsx**

```typescript
import type { TitanPaylineWin } from "../titan-protocol";
import type { ServerPayline } from "../../../ws/protocol";

// Pre-computed SVG path data for each payline shape (from GDD).
// Each path is a cubic bezier through the 5 center points of each reel.
// Grid cell size: 64px + 6px gap = 70px per col, 70px per row.
// Cell center offsets from grid top-left: colCenter = col * 70 + 32, rowCenter = row * 70 + 32
const CELL_W = 70; // 64 + 6 gap
const CELL_H = 70;

function makePath(rows: number[]): string {
  const pts = rows.map((row, col) => {
    const x = col * CELL_W + 32;
    const y = row * CELL_H + 32;
    return `${col === 0 ? "M" : "L"} ${x} ${y}`;
  });
  return pts.join(" ");
}

const PAYLINE_PATHS: Record<string, string> = {
  P01: makePath([1, 1, 1, 1, 1]),
  P02: makePath([0, 0, 0, 0, 0]),
  P03: makePath([2, 2, 2, 2, 2]),
  P04: makePath([2, 1, 0, 1, 2]),
  P05: makePath([0, 1, 2, 1, 0]),
  P06: makePath([0, 0, 1, 0, 0]),
  P07: makePath([2, 0, 1, 0, 0]),
  P08: makePath([1, 2, 2, 2, 1]),
  P09: makePath([1, 0, 0, 0, 1]),
  P10: makePath([1, 0, 1, 0, 1]),
};

interface TitanPaylineOverlayProps {
  paylines: ServerPayline[];
  paylineWins: TitanPaylineWin[];
  visible: boolean;
}

export default function TitanPaylineOverlay({
  paylines,
  paylineWins,
  visible,
}: TitanPaylineOverlayProps) {
  if (!visible || paylineWins.length === 0) return null;

  const winIds = new Set(paylineWins.map((w) => w.paylineId));

  return (
    <svg
      className="titan-payline-overlay"
      viewBox={`0 0 ${CELL_W * 5 - 6} ${CELL_H * 3 - 6}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {paylines
        .filter((p) => winIds.has(p.id))
        .map((p) => {
          const win = paylineWins.find((w) => w.paylineId === p.id);
          const pathData = PAYLINE_PATHS[p.id] ?? makePath(p.rows);
          const direction = win?.direction === "RTL" ? -1 : 1;
          return (
            <g key={p.id} className="payline-group">
              <path
                d={pathData}
                fill="none"
                stroke="var(--titan-divine-amber)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`payline-glow${direction === -1 ? " payline-rtl" : ""}`}
              />
              {win && (
                <text
                  x={CELL_W * 2.5 - 3}
                  y={p.rows[2] * CELL_H + 28}
                  textAnchor="middle"
                  className="payline-win-text"
                  fill="var(--titan-forge-gold)"
                  fontFamily="var(--titan-display)"
                  fontSize={14}
                  fontWeight={700}
                >
                  ${win.winAmount.toFixed(2)}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}
```

- [ ] **Step 2: Add payline CSS to slot-machine.css**

```css
/* --- Payline Overlay --- */
.titan-payline-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  width: calc(100% - 24px);
  height: calc(100% - 24px);
  pointer-events: none;
  z-index: 10;
}

.payline-group .payline-glow {
  stroke-dasharray: 8 4;
  animation: payline-dash 0.5s linear infinite;
  filter: drop-shadow(0 0 6px var(--titan-divine-amber));
}

.payline-group .payline-rtl {
  animation-direction: reverse;
}

@keyframes payline-dash {
  to { stroke-dashoffset: -24; }
}

.payline-win-text {
  paint-order: stroke;
  stroke: var(--titan-obsidian);
  stroke-width: 3px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/games/titan-wrath/components/TitanPaylineOverlay.tsx src/games/titan-wrath/slot-machine.css
git commit -m "feat: TitanPaylineOverlay — SVG 10 paylines + winning highlight animation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: TitanWildExpansion — wild column animation

**Files:**
- Create: `src/games/titan-wrath/components/TitanWildExpansion.tsx`

**Consumes:** `TitanWildSpinInfo` from `../titan-protocol`

**Produces:** `<TitanWildExpansion>` fire burst overlay triggered when new wilds appear.

- [ ] **Step 1: Write TitanWildExpansion.tsx**

```typescript
import { useEffect, useState } from "react";
import type { TitanWildSpinInfo } from "../titan-protocol";

const CELL_W = 70;
const CELL_H = 70;

interface TitanWildExpansionProps {
  wildInfo: TitanWildSpinInfo | undefined;
  onComplete: () => void;
}

export default function TitanWildExpansion({
  wildInfo,
  onComplete,
}: TitanWildExpansionProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!wildInfo?.triggered || wildInfo.wildReels.length === 0) {
      setAnimating(false);
      return;
    }
    setAnimating(true);
    const timer = window.setTimeout(() => {
      setAnimating(false);
      onComplete();
    }, 600); // 0.6s for fire burst animation
    return () => window.clearTimeout(timer);
  }, [wildInfo, onComplete]);

  if (!animating || !wildInfo) return null;

  return (
    <div className="titan-wild-expansion" aria-hidden>
      {wildInfo.wildReels.map((col) => {
        const left = col * CELL_W + 12; // 12px grid padding
        return (
          <div
            key={col}
            className="wild-fire-burst"
            style={{ left, width: 64 }}
          >
            <span className="wild-fire-text">W</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add wild expansion CSS**

```css
/* --- Wild Expansion --- */
.titan-wild-expansion {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 15;
}

.wild-fire-burst {
  position: absolute;
  top: 12px;
  height: calc(100% - 24px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse, rgba(232, 69, 45, 0.4), rgba(212, 168, 67, 0.2), transparent);
  animation: fire-expand 0.6s ease-out both;
}

.wild-fire-text {
  font-family: var(--titan-display);
  font-size: 3rem;
  font-weight: 700;
  color: var(--titan-wrath-vermilion);
  text-shadow: 0 0 20px var(--titan-wrath-vermilion), 0 0 40px var(--titan-forge-gold);
  animation: fire-text 0.4s ease-out 0.1s both;
}

@keyframes fire-expand {
  0% { opacity: 0; transform: scaleY(0.5); }
  50% { opacity: 1; transform: scaleY(1.05); }
  100% { opacity: 0.8; transform: scaleY(1); }
}

@keyframes fire-text {
  0% { opacity: 0; transform: scale(0.3); }
  100% { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/games/titan-wrath/components/TitanWildExpansion.tsx src/games/titan-wrath/slot-machine.css
git commit -m "feat: TitanWildExpansion — fire burst animation for wild column expansion

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: TitanDisplayBox + TitanJackpotBar + TitanWinCelebration

**Files:**
- Create: `src/games/titan-wrath/components/TitanDisplayBox.tsx`
- Create: `src/games/titan-wrath/components/TitanJackpotBar.tsx`
- Create: `src/games/titan-wrath/components/TitanWinCelebration.tsx`

**Produces:** Info display panel, jackpot tier bar, combo celebration text overlay.

- [ ] **Step 1: Write TitanDisplayBox.tsx**

```typescript
import { useEffect, useState } from "react";

interface TitanDisplayBoxProps {
  spinning: boolean;
  totalWin: number | null; // null = no win to display, show USP
}

const USP_MESSAGES = ["Win up to 2100x Bet", "Good luck"];

export default function TitanDisplayBox({ spinning, totalWin }: TitanDisplayBoxProps) {
  const [uspIndex, setUspIndex] = useState(0);

  // Cycle USP messages when idle
  useEffect(() => {
    if (spinning || totalWin !== null) return;
    const timer = window.setInterval(() => {
      setUspIndex((i) => (i + 1) % USP_MESSAGES.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [spinning, totalWin]);

  const showWin = !spinning && totalWin !== null && totalWin > 0;

  return (
    <div className={`titan-display-box${showWin ? " display-win" : ""}`}>
      {showWin ? (
        <span className="titan-win-amount" key={totalWin}>
          ${totalWin.toFixed(2)}
        </span>
      ) : (
        <span className="titan-usp-text">
          {USP_MESSAGES[uspIndex]}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write TitanJackpotBar.tsx**

```typescript
import type { JackpotPoolsByTier } from "../../../ws/protocol";

const TIER_ORDER = ["MINI", "MINOR", "MAJOR", "GRAND"] as const;

interface TitanJackpotBarProps {
  poolsByTier: JackpotPoolsByTier;
}

export default function TitanJackpotBar({ poolsByTier }: TitanJackpotBarProps) {
  return (
    <div className="titan-jackpot-bar">
      {TIER_ORDER.map((tier) => {
        const pool = poolsByTier[tier];
        const amount = pool?.currentAmount
          ? Number(pool.currentAmount).toFixed(2)
          : "0.00";
        return (
          <div key={tier} className={`jackpot-tier tier-${tier.toLowerCase()}`}>
            <span className="tier-label">{tier}</span>
            <span className="tier-amount">${amount}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Write TitanWinCelebration.tsx**

```typescript
import { useEffect, useState } from "react";

type ComboLevel = "COMBO" | "SUPER_COMBO" | "MEGA_COMBO";

interface TitanWinCelebrationProps {
  comboLevel: ComboLevel | null;
}

export default function TitanWinCelebration({ comboLevel }: TitanWinCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ComboLevel | null>(null);

  useEffect(() => {
    if (!comboLevel) {
      setVisible(false);
      return;
    }
    setCurrent(comboLevel);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1500);
    return () => window.clearTimeout(timer);
  }, [comboLevel]);

  if (!visible || !current) return null;

  return (
    <div className="titan-combo-overlay" aria-hidden>
      <span className={`combo-text combo-${current.toLowerCase().replace("_", "-")}`}>
        {current.replace("_", " ")}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Add display/jackpot/combo CSS to slot-machine.css**

```css
/* --- Display Box --- */
.titan-display-box {
  background: #FFFFFF;
  border-radius: 6px;
  padding: 10px 16px;
  text-align: center;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
}

.titan-display-box .titan-usp-text {
  font-family: var(--titan-body);
  font-size: 0.875rem;
  color: var(--titan-ash);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.titan-display-box.display-win {
  background: linear-gradient(135deg, #FFF8E1, #FFF3CD);
}

.titan-display-box .titan-win-amount {
  font-family: var(--titan-display);
  font-size: 2rem;
  font-weight: 700;
  color: var(--titan-forge-gold);
  animation: win-pop-in 0.3s ease-out;
}

@keyframes win-pop-in {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* --- Jackpot Bar --- */
.titan-jackpot-bar {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: var(--titan-ember);
  border-radius: 6px 6px 0 0;
}

.jackpot-tier {
  flex: 1;
  text-align: center;
  padding: 6px 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
}

.tier-label {
  display: block;
  font-family: var(--titan-display);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--titan-ash);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tier-amount {
  display: block;
  font-family: var(--titan-body);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--titan-smoke);
  margin-top: 2px;
}

.tier-grand .tier-label,
.tier-major .tier-label {
  color: var(--titan-forge-gold);
}

.tier-grand .tier-amount,
.tier-major .tier-amount {
  color: var(--titan-forge-gold);
}

/* --- Combo Overlay --- */
.titan-combo-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}

.combo-text {
  font-family: var(--titan-display);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 4px;
  animation: combo-burst 1.5s ease-out both;
}

.combo-combo {
  font-size: 2rem;
  color: var(--titan-forge-gold);
  text-shadow: 0 0 20px var(--titan-forge-gold);
}

.combo-super-combo {
  font-size: 2.5rem;
  color: var(--titan-divine-amber);
  text-shadow: 0 0 30px var(--titan-divine-amber);
}

.combo-mega-combo {
  font-size: 3rem;
  color: var(--titan-wrath-vermilion);
  text-shadow: 0 0 40px var(--titan-wrath-vermilion), 0 0 80px var(--titan-forge-gold);
}

@keyframes combo-burst {
  0% { transform: scale(0.3); opacity: 0; }
  20% { transform: scale(1.15); opacity: 1; }
  30% { transform: scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/games/titan-wrath/components/TitanDisplayBox.tsx src/games/titan-wrath/components/TitanJackpotBar.tsx src/games/titan-wrath/components/TitanWinCelebration.tsx src/games/titan-wrath/slot-machine.css
git commit -m "feat: TitanDisplayBox, JackpotBar, WinCelebration — info display and combo overlay

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: TitanControls — spin, bet, super bet, auto spin

**Files:**
- Create: `src/games/titan-wrath/components/TitanControls.tsx`
- Create: `src/games/titan-wrath/components/AutospinPicker.tsx`
- Create: `src/games/titan-wrath/components/BetPickerModal.tsx`
- Create: `src/games/titan-wrath/hooks/useAutoSpin.ts` (copy from Angkor with Titan spin signature)

**Produces:** Full control bar at bottom: bet +/-, super bet toggle, spin button, auto spin picker.

- [ ] **Step 1: Write AutospinPicker.tsx**

```typescript
interface AutospinPickerProps {
  open: boolean;
  onSelect: (count: number) => void;
  onClose: () => void;
}

const OPTIONS = [5, 10, 25, 50, 100, Infinity];

export default function AutospinPicker({ open, onSelect, onClose }: AutospinPickerProps) {
  if (!open) return null;
  return (
    <div className="autospin-backdrop" onClick={onClose}>
      <div className="autospin-picker" onClick={(e) => e.stopPropagation()}>
        <h3 className="autospin-title">Auto Spin</h3>
        <div className="autospin-options">
          {OPTIONS.map((n) => (
            <button
              key={n}
              className="autospin-option"
              onClick={() => { onSelect(n); onClose(); }}
            >
              {n === Infinity ? "∞" : n}
            </button>
          ))}
        </div>
        <button className="autospin-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write BetPickerModal.tsx**

```typescript
interface BetPickerModalProps {
  open: boolean;
  betLevels: string[];
  currentBet: string;
  onSelect: (bet: string) => void;
  onClose: () => void;
}

export default function BetPickerModal({
  open,
  betLevels,
  currentBet,
  onSelect,
  onClose,
}: BetPickerModalProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bet-picker" onClick={(e) => e.stopPropagation()}>
        <h3 className="bet-picker-title">Select Bet</h3>
        <div className="bet-picker-grid">
          {betLevels.map((level) => (
            <button
              key={level}
              className={`bet-option${level === currentBet ? " bet-selected" : ""}`}
              onClick={() => { onSelect(level); onClose(); }}
            >
              ${Number(level).toFixed(2)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Copy useAutoSpin.ts from Angkor (identical logic)**

```bash
cp src/games/game-the-last-guardian-of-angkor/hooks/useAutoSpin.ts src/games/titan-wrath/hooks/useAutoSpin.ts
```

- [ ] **Step 4: Write TitanControls.tsx**

```typescript
import { useCallback, useState } from "react";
import AutospinPicker from "./AutospinPicker";
import BetPickerModal from "./BetPickerModal";

interface TitanControlsProps {
  betLevels: string[];
  selectBetValue: string;
  onBetChange: (bet: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  onSpin: () => void;
  autoSpinActive: boolean;
  autoSpinCount: number | null;
  onAutoSpinStart: (count: number) => void;
  onAutoSpinStop: () => void;
  superBetActive: boolean;
  superBetToggleable: boolean;
  onSuperBetToggle: (active: boolean) => void;
}

export default function TitanControls({
  betLevels,
  selectBetValue,
  onBetChange,
  betDisabled,
  canSpin,
  spinning,
  onSpin,
  autoSpinActive,
  autoSpinCount,
  onAutoSpinStart,
  onAutoSpinStop,
  superBetActive,
  superBetToggleable,
  onSuperBetToggle,
}: TitanControlsProps) {
  const [autoPickerOpen, setAutoPickerOpen] = useState(false);
  const [betPickerOpen, setBetPickerOpen] = useState(false);

  const handleAutoSelect = useCallback((count: number) => {
    onAutoSpinStart(count);
  }, [onAutoSpinStart]);

  const betDisplay = `$${Number(selectBetValue).toFixed(2)}`;

  return (
    <>
      <div className="titan-controls">
        {/* Super Bet Toggle */}
        <button
          className={`titan-super-bet${superBetActive ? " super-bet-on" : ""}`}
          onClick={() => onSuperBetToggle(!superBetActive)}
          disabled={!superBetToggleable}
          title={superBetActive ? "Super Bet: ON" : "Super Bet: OFF"}
        >
          <span className="super-bet-label">SUPER BET</span>
          {superBetActive && <span className="super-bet-badge">DOUBLE WILDS!</span>}
        </button>

        {/* Bet Controls */}
        <div className="titan-bet-controls">
          <button
            className="bet-btn"
            disabled={betDisabled}
            onClick={() => {
              const idx = betLevels.indexOf(selectBetValue);
              if (idx > 0) onBetChange(betLevels[idx - 1]);
            }}
          >
            −
          </button>
          <button className="bet-display" onClick={() => !betDisabled && setBetPickerOpen(true)}>
            {betDisplay}
          </button>
          <button
            className="bet-btn"
            disabled={betDisabled}
            onClick={() => {
              const idx = betLevels.indexOf(selectBetValue);
              if (idx < betLevels.length - 1) onBetChange(betLevels[idx + 1]);
            }}
          >
            +
          </button>
        </div>

        {/* Spin Button */}
        <button
          className={`titan-spin-btn${spinning ? " spin-spinning" : ""}${autoSpinActive ? " spin-auto" : ""}`}
          disabled={!canSpin && !spinning}
          onClick={() => {
            if (autoSpinActive) { onAutoSpinStop(); }
            else if (spinning) { /* stop handled by auto-spin */ }
            else { onSpin(); }
          }}
        >
          {autoSpinActive && autoSpinCount ? (
            <span className="spin-auto-count">{autoSpinCount}</span>
          ) : spinning ? (
            <span className="spin-stop-icon">■</span>
          ) : (
            <span className="spin-icon">⚡</span>
          )}
        </button>

        {/* Auto Spin Button */}
        <button
          className="titan-auto-btn"
          disabled={!canSpin}
          onClick={() => {
            if (autoSpinActive) { onAutoSpinStop(); }
            else { setAutoPickerOpen(true); }
          }}
        >
          {autoSpinActive ? "STOP" : "AUTO"}
        </button>
      </div>

      <AutospinPicker
        open={autoPickerOpen}
        onSelect={handleAutoSelect}
        onClose={() => setAutoPickerOpen(false)}
      />
      <BetPickerModal
        open={betPickerOpen}
        betLevels={betLevels}
        currentBet={selectBetValue}
        onSelect={onBetChange}
        onClose={() => setBetPickerOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 5: Add controls CSS**

```css
/* --- Controls --- */
.titan-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--titan-ember);
  border-radius: 0 0 6px 6px;
}

/* Super Bet */
.titan-super-bet {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--titan-ash);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.titan-super-bet:disabled { opacity: 0.4; cursor: not-allowed; }

.titan-super-bet.super-bet-on {
  border-color: var(--titan-wrath-vermilion);
  box-shadow: 0 0 12px rgba(232, 69, 45, 0.4);
}

.super-bet-label {
  font-family: var(--titan-display);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--titan-ash);
  letter-spacing: 1px;
}

.super-bet-on .super-bet-label { color: var(--titan-wrath-vermilion); }

.super-bet-badge {
  font-family: var(--titan-body);
  font-size: 0.6rem;
  color: var(--titan-forge-gold);
  margin-top: 4px;
}

/* Bet Controls */
.titan-bet-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bet-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--titan-ash);
  border-radius: 50%;
  color: var(--titan-smoke);
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bet-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.bet-btn:not(:disabled):hover { border-color: var(--titan-forge-gold); color: var(--titan-forge-gold); }

.bet-display {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid var(--titan-ash);
  border-radius: 6px;
  color: var(--titan-smoke);
  font-family: var(--titan-body);
  font-size: 0.9rem;
  cursor: pointer;
}

/* Spin Button */
.titan-spin-btn {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 3px solid var(--titan-forge-gold);
  background: linear-gradient(135deg, var(--titan-ember), var(--titan-obsidian));
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 0 16px rgba(212, 168, 67, 0.3);
}

.titan-spin-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.titan-spin-btn:not(:disabled):hover {
  box-shadow: 0 0 28px rgba(212, 168, 67, 0.6);
  transform: scale(1.05);
}

.titan-spin-btn.spin-spinning {
  border-radius: 8px;
  border-color: var(--titan-wrath-vermilion);
}

.titan-spin-btn.spin-auto {
  border-radius: 8px;
}

.spin-icon {
  font-size: 1.75rem;
  animation: spin-arrows 2s linear infinite;
}

@keyframes spin-arrows {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.spin-stop-icon {
  font-size: 1.5rem;
  color: var(--titan-wrath-vermilion);
}

.spin-auto-count {
  font-family: var(--titan-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--titan-forge-gold);
}

/* Auto Spin Button */
.titan-auto-btn {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--titan-ash);
  border-radius: 8px;
  color: var(--titan-smoke);
  font-family: var(--titan-display);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
}

.titan-auto-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.titan-auto-btn:not(:disabled):hover { border-color: var(--titan-forge-gold); }

/* --- Autospin Picker --- */
.autospin-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.autospin-picker {
  background: var(--titan-ember);
  border: 1px solid var(--titan-forge-gold);
  border-radius: 12px;
  padding: 24px;
  min-width: 240px;
}

.autospin-title {
  font-family: var(--titan-display);
  font-size: 1.25rem;
  color: var(--titan-forge-gold);
  text-align: center;
  margin: 0 0 16px;
}

.autospin-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.autospin-option {
  padding: 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--titan-ash);
  border-radius: 6px;
  color: var(--titan-smoke);
  font-family: var(--titan-display);
  font-size: 1rem;
  cursor: pointer;
}

.autospin-option:hover { border-color: var(--titan-forge-gold); color: var(--titan-forge-gold); }

.autospin-cancel {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 8px;
  background: transparent;
  border: none;
  color: var(--titan-ash);
  font-family: var(--titan-body);
  cursor: pointer;
}

/* --- Bet Picker --- */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.bet-picker {
  background: var(--titan-ember);
  border: 1px solid var(--titan-forge-gold);
  border-radius: 12px;
  padding: 24px;
  max-width: 320px;
  width: 90%;
}

.bet-picker-title {
  font-family: var(--titan-display);
  font-size: 1.25rem;
  color: var(--titan-forge-gold);
  text-align: center;
  margin: 0 0 16px;
}

.bet-picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.bet-option {
  padding: 8px 4px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--titan-ash);
  border-radius: 4px;
  color: var(--titan-smoke);
  font-size: 0.75rem;
  cursor: pointer;
}

.bet-option:hover { border-color: var(--titan-forge-gold); }
.bet-option.bet-selected { border-color: var(--titan-forge-gold); background: rgba(212, 168, 67, 0.15); }
```

- [ ] **Step 6: Commit**

```bash
git add src/games/titan-wrath/components/TitanControls.tsx src/games/titan-wrath/components/AutospinPicker.tsx src/games/titan-wrath/components/BetPickerModal.tsx src/games/titan-wrath/hooks/useAutoSpin.ts src/games/titan-wrath/slot-machine.css
git commit -m "feat: TitanControls — spin button, bet +/-, super bet toggle, auto spin picker

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: TitanSlotMachine — container + PaytableModal + MenuPopover

**Files:**
- Create: `src/games/titan-wrath/components/TitanSlotMachine.tsx`
- Create: `src/games/titan-wrath/components/PaytableModal.tsx`
- Create: `src/games/titan-wrath/components/MenuPopover.tsx`

**Produces:** Cabinet container composing all components, paytable display, menu dropdown.

- [ ] **Step 1: Write PaytableModal.tsx**

```typescript
import type { GameSymbol } from "../../../ws/protocol";

interface PaytableModalProps {
  open: boolean;
  symbols: GameSymbol[];
  onClose: () => void;
}

const SYMBOL_ORDER = ["A", "B", "C", "D", "E", "F", "G", "W"];

export default function PaytableModal({ open, symbols, onClose }: PaytableModalProps) {
  if (!open) return null;
  const map = new Map(symbols.map((s) => [s.id, s]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="paytable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paytable-header">
          <h2 className="paytable-title">PAYTABLE</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="paytable-grid">
          {SYMBOL_ORDER.map((id) => {
            const sym = map.get(id);
            const payouts = sym?.payouts;
            const isWild = sym?.substitutes === true;
            return (
              <div key={id} className={`paytable-row${isWild ? " paytable-wild" : ""}`}>
                <span className="paytable-symbol">{id}</span>
                {isWild ? (
                  <span className="paytable-wild-desc">Substitutes all symbols. Expands on reels 2-4.</span>
                ) : (
                  <div className="paytable-payouts">
                    <span>3: {payouts?.["3"] ? `${payouts["3"]}x` : "—"}</span>
                    <span>4: {payouts?.["4"] ? `${payouts["4"]}x` : "—"}</span>
                    <span>5: {payouts?.["5"] ? `${payouts["5"]}x` : "—"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write MenuPopover.tsx**

```typescript
interface MenuPopoverProps {
  open: boolean;
  onOpenPaytable: () => void;
  onClose: () => void;
}

export default function MenuPopover({ open, onOpenPaytable, onClose }: MenuPopoverProps) {
  if (!open) return null;

  const items: { label: string; icon: string; action: () => void; disabled?: boolean }[] = [
    { label: "Paytable", icon: "📋", action: () => { onOpenPaytable(); onClose(); } },
    { label: "Game Rules", icon: "📖", action: () => {}, disabled: true },
    { label: "Sound", icon: "🔊", action: () => {}, disabled: true },
    { label: "Music", icon: "🎵", action: () => {}, disabled: true },
    { label: "History", icon: "🕐", action: () => {}, disabled: true },
  ];

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div className="menu-popover" onClick={(e) => e.stopPropagation()}>
        {items.map((item) => (
          <button
            key={item.label}
            className="menu-item"
            onClick={item.action}
            disabled={item.disabled}
          >
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
            {item.disabled && <span className="menu-soon">Soon</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write TitanSlotMachine.tsx**

```typescript
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import type { GameSymbol, JackpotPoolsByTier, ServerPayline } from "../../../ws/protocol";
import type { TitanPaylineWin, TitanWildSpinInfo } from "../titan-protocol";
import TitanReelGrid from "./TitanReelGrid";
import TitanPaylineOverlay from "./TitanPaylineOverlay";
import TitanWildExpansion from "./TitanWildExpansion";
import TitanWinCelebration from "./TitanWinCelebration";
import TitanDisplayBox from "./TitanDisplayBox";
import TitanJackpotBar from "./TitanJackpotBar";
import TitanControls from "./TitanControls";
import PaytableModal from "./PaytableModal";
import MenuPopover from "./MenuPopover";

interface TitanSlotMachineProps {
  // Grid
  patternGrid: string;
  lockedReels: number[];
  spinIndex: number;

  // Paylines
  serverPaylines: ServerPayline[];
  paylineWins: TitanPaylineWin[];

  // Wild expansion
  wildInfo: TitanWildSpinInfo | undefined;
  wildAnimDone: () => void;

  // Celebration
  comboLevel: "COMBO" | "SUPER_COMBO" | "MEGA_COMBO" | null;

  // Display
  spinning: boolean;
  totalWin: number | null;

  // Jackpot
  jackpotPoolsByTier: JackpotPoolsByTier;

  // Controls
  betLevels: string[];
  selectBetValue: string;
  onBetChange: (bet: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  onSpin: () => void;
  autoSpinActive: boolean;
  autoSpinCount: number | null;
  onAutoSpinStart: (count: number) => void;
  onAutoSpinStop: () => void;
  superBetActive: boolean;
  superBetToggleable: boolean;
  onSuperBetToggle: (v: boolean) => void;

  // Meta
  error: string | null;
  symbols: GameSymbol[];

  // Balance
  balance: string | null;
  balanceConnected: boolean;

  // Toolbar
  toolbarSlot?: ReactNode;
}

export default function TitanSlotMachine(props: TitanSlotMachineProps) {
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const showPaylines = !props.spinning && props.paylineWins.length > 0;

  const handleWildDone = useCallback(() => {
    props.wildAnimDone();
  }, [props]);

  return (
    <div className="titan-slot-machine">
      {/* Toolbar */}
      {props.toolbarSlot && (
        <div className="titan-toolbar">{props.toolbarSlot}</div>
      )}

      {/* Error */}
      {props.error && <div className="titan-error-banner">{props.error}</div>}

      {/* Balance */}
      {props.balance !== null && (
        <div className="titan-balance-row">
          <span className="balance-label">BALANCE</span>
          <span className="balance-amount">
            ${Number(props.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Jackpot Bar */}
      <TitanJackpotBar poolsByTier={props.jackpotPoolsByTier} />

      {/* Grid Area */}
      <div className="titan-grid-area" data-spinning={props.spinning ? "" : undefined}>
        <TitanReelGrid
          patternGrid={props.patternGrid}
          lockedReels={props.lockedReels}
          spinning={props.spinning}
          spinIndex={props.spinIndex}
        />

        <TitanPaylineOverlay
          paylines={props.serverPaylines}
          paylineWins={props.paylineWins}
          visible={showPaylines}
        />

        <TitanWildExpansion
          wildInfo={props.wildInfo}
          onComplete={handleWildDone}
        />

        <TitanWinCelebration comboLevel={props.comboLevel} />
      </div>

      {/* Display Box */}
      <TitanDisplayBox
        spinning={props.spinning}
        totalWin={props.totalWin}
      />

      {/* Controls */}
      <TitanControls
        betLevels={props.betLevels}
        selectBetValue={props.selectBetValue}
        onBetChange={props.onBetChange}
        betDisabled={props.betDisabled}
        canSpin={props.canSpin}
        spinning={props.spinning}
        onSpin={props.onSpin}
        autoSpinActive={props.autoSpinActive}
        autoSpinCount={props.autoSpinCount}
        onAutoSpinStart={props.onAutoSpinStart}
        onAutoSpinStop={props.onAutoSpinStop}
        superBetActive={props.superBetActive}
        superBetToggleable={props.superBetToggleable}
        onSuperBetToggle={props.onSuperBetToggle}
      />

      {/* Menu button (floating right of controls) */}
      <button className="titan-menu-btn" onClick={() => setMenuOpen(true)}>
        ☰
      </button>

      {/* Modals */}
      <PaytableModal
        open={paytableOpen}
        symbols={props.symbols}
        onClose={() => setPaytableOpen(false)}
      />
      <MenuPopover
        open={menuOpen}
        onOpenPaytable={() => setPaytableOpen(true)}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add slot machine + paytable + menu CSS**

```css
/* --- Slot Machine Container --- */
.titan-slot-machine {
  position: relative;
  max-width: 400px;
  margin: 0 auto;
  background: var(--titan-obsidian);
  border: 2px solid var(--titan-ember);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
}

.titan-toolbar {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
}

.titan-error-banner {
  padding: 8px 12px;
  background: rgba(232, 69, 45, 0.15);
  border-bottom: 1px solid var(--titan-wrath-vermilion);
  color: var(--titan-wrath-vermilion);
  font-family: var(--titan-body);
  font-size: 0.8rem;
  text-align: center;
}

.titan-balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.2);
}

.balance-label {
  font-family: var(--titan-display);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--titan-ash);
  letter-spacing: 1px;
}

.balance-amount {
  font-family: var(--titan-body);
  font-size: 1rem;
  font-weight: 500;
  color: var(--titan-smoke);
}

.titan-grid-area {
  position: relative;
}

/* Menu button */
.titan-menu-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--titan-ash);
  border-radius: 50%;
  color: var(--titan-smoke);
  font-size: 1rem;
  cursor: pointer;
  z-index: 5;
}

/* --- Paytable Modal --- */
.paytable-modal {
  background: var(--titan-ember);
  border: 1px solid var(--titan-forge-gold);
  border-radius: 12px;
  padding: 20px;
  max-width: 360px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.paytable-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.paytable-title {
  font-family: var(--titan-display);
  font-size: 1.25rem;
  color: var(--titan-forge-gold);
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--titan-ash);
  border-radius: 50%;
  color: var(--titan-smoke);
  cursor: pointer;
}

.paytable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(138, 133, 128, 0.15);
}

.paytable-symbol {
  font-family: var(--titan-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--titan-forge-gold);
}

.paytable-payouts {
  display: flex;
  gap: 12px;
  font-family: var(--titan-body);
  font-size: 0.8rem;
  color: var(--titan-smoke);
}

.paytable-wild .paytable-symbol { color: var(--titan-wrath-vermilion); }
.paytable-wild-desc {
  font-family: var(--titan-body);
  font-size: 0.7rem;
  color: var(--titan-smoke);
  max-width: 180px;
}

/* --- Menu Popover --- */
.menu-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.menu-popover {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--titan-ember);
  border: 1px solid var(--titan-forge-gold);
  border-radius: 12px;
  padding: 8px;
  min-width: 200px;
  z-index: 101;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--titan-smoke);
  font-family: var(--titan-body);
  font-size: 0.9rem;
  cursor: pointer;
}

.menu-item:hover:not(:disabled) { background: rgba(212, 168, 67, 0.1); }

.menu-item:disabled { opacity: 0.4; cursor: not-allowed; }

.menu-icon { font-size: 1.1rem; }
.menu-soon {
  margin-left: auto;
  font-size: 0.65rem;
  color: var(--titan-ash);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/games/titan-wrath/components/TitanSlotMachine.tsx src/games/titan-wrath/components/PaytableModal.tsx src/games/titan-wrath/components/MenuPopover.tsx src/games/titan-wrath/slot-machine.css
git commit -m "feat: TitanSlotMachine — cabinet container, paytable modal, menu popover

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: GameScreen — main component wiring everything

**Files:**
- Create: `src/games/titan-wrath/GameScreen.tsx`

**Consumes:**
- `GameScreenProps` from `../../games`
- `useTitanSession` from `./useTitanSession`
- `useAutoSpin` from `./hooks/useAutoSpin`
- `readEnvDefaults` from `../../config`
- `TitanSlotMachine` from `./components/TitanSlotMachine`

**Produces:** `<GameScreen>` — the exported component that App renders for the game view.

- [ ] **Step 1: Write GameScreen.tsx**

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSyncRef } from "../../hooks/useSyncRef";
import { useAutoSpin } from "./hooks/useAutoSpin";
import { useTitanSession } from "./useTitanSession";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import TitanSlotMachine from "./components/TitanSlotMachine";

export default function GameScreen({
  agencyUserToken,
  wsAccessToken,
  balance: parentBalance,
  depositBusy,
  depositFunds,
  onBackToLobby,
  onLogout,
}: GameScreenProps) {
  const defaults = useMemo(() => readEnvDefaults(), []);

  const session = useTitanSession(
    defaults.wsUrl,
    wsAccessToken,
    { onTokenBan: onLogout, onConnectionLost: onLogout },
  );

  const {
    phase,
    sessionReady,
    joinGame,
    error,
    betLevels,
    balance,
    selectBetValue,
    spin,
    canSpin,
    isSpinning,
    viewSpin,
    lockedReels,
    superBetActive,
    setSuperBetActive,
    superBetToggleable,
    comboLevel,
    paylineWins,
    totalWin,
    symbolCatalog,
    serverPaylines,
    jackpotPoolsByTier,
  } = session;

  // Join on mount
  useEffect(() => {
    if (session.gameScreenActive && !session.sessionReady) {
      void joinGame();
    }
  }, [session.gameScreenActive, session.sessionReady, joinGame]);

  // Auto-spin state
  const [autoSpinActive, setAutoSpinActive] = useState(false);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState<number | null>(null);
  const [spinIndex, setSpinIndex] = useState(0);

  const spinUiActive = isSpinning;
  const spinUiActiveRef = useRef(spinUiActive);
  useSyncRef(spinUiActiveRef, spinUiActive);

  const roundIdle = !isSpinning;

  // Spin handler — call session.spin() and handle auto-spin count
  const executeSpin = useCallback(async () => {
    const result = await spin();
    if (result) {
      setSpinIndex((i) => i + 1);
      // Decrement auto-spin counter
      setAutoSpinRemaining((prev) => {
        if (prev === null) return null;
        if (prev === Infinity) return Infinity;
        return prev > 0 ? prev - 1 : 0;
      });
    }
  }, [spin]);

  // Auto-spin lifecycle
  const startAutoSpin = useCallback((count: number) => {
    setAutoSpinActive(true);
    setAutoSpinRemaining(count);
  }, []);

  const stopAutoSpin = useCallback(() => {
    setAutoSpinActive(false);
    setAutoSpinRemaining(null);
  }, []);

  // Stop auto-spin when count reaches 0
  useEffect(() => {
    if (autoSpinRemaining === 0) {
      stopAutoSpin();
    }
  }, [autoSpinRemaining, stopAutoSpin]);

  // Auto-spin scheduling
  useAutoSpin({
    active: autoSpinActive && sessionReady,
    roundIdle,
    canStartRound: canSpin && !spinUiActive,
    onRunRound: () => void executeSpin(),
  });

  // Handle respin chain — auto spin when round.state === "RESPIN"
  useEffect(() => {
    if (!viewSpin) return;
    if (viewSpin.round.state === "RESPIN" && roundIdle && canSpin) {
      const timer = window.setTimeout(() => {
        void executeSpin();
      }, 800); // 0.8s delay between respins
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSpin?.round.state, roundIdle, canSpin]);

  // Derived grid state
  const patternGrid = viewSpin?.spin?.patternGrid ?? "";
  const wildInfo = viewSpin?.spin?.titanWild;
  const currentTotalWin = viewSpin?.round?.totalWin ?? null;

  const betDisabled = isSpinning || !sessionReady || betLevels.length === 0;

  const joining = !sessionReady && phase === "joining";

  if (joining) {
    return (
      <div className="titan-screen">
        <p className="titan-joining" role="status">Joining Titan's Wrath…</p>
      </div>
    );
  }

  return (
    <div className="titan-screen">
      <TitanSlotMachine
        patternGrid={patternGrid}
        lockedReels={lockedReels}
        spinIndex={spinIndex}
        serverPaylines={serverPaylines}
        paylineWins={paylineWins}
        wildInfo={wildInfo}
        wildAnimDone={() => {}}
        comboLevel={comboLevel as "COMBO" | "SUPER_COMBO" | "MEGA_COMBO" | null}
        spinning={isSpinning}
        totalWin={currentTotalWin}
        jackpotPoolsByTier={jackpotPoolsByTier}
        betLevels={betLevels}
        selectBetValue={selectBetValue}
        onBetChange={session.setBet}
        betDisabled={betDisabled}
        canSpin={canSpin && !autoSpinActive}
        onSpin={() => void executeSpin()}
        autoSpinActive={autoSpinActive}
        autoSpinCount={autoSpinRemaining}
        onAutoSpinStart={startAutoSpin}
        onAutoSpinStop={stopAutoSpin}
        superBetActive={superBetActive}
        superBetToggleable={superBetToggleable}
        onSuperBetToggle={setSuperBetActive}
        error={error}
        symbols={symbolCatalog}
        balance={balance}
        balanceConnected={sessionReady}
        toolbarSlot={
          <>
            <button type="button" className="titan-lobby-btn" onClick={onBackToLobby}>
              ← Lobby
            </button>
            <button type="button" className="titan-logout-btn" onClick={onLogout}>
              Log out
            </button>
          </>
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Add screen-level CSS to slot-machine.css**

```css
/* --- Game Screen --- */
.titan-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--titan-obsidian);
}

.titan-joining {
  font-family: var(--titan-display);
  font-size: 1.25rem;
  color: var(--titan-forge-gold);
  animation: pulse-text 1.5s ease-in-out infinite;
}

@keyframes pulse-text {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.titan-lobby-btn,
.titan-logout-btn {
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--titan-ash);
  border-radius: 4px;
  color: var(--titan-smoke);
  font-family: var(--titan-body);
  font-size: 0.8rem;
  cursor: pointer;
}

.titan-lobby-btn:hover,
.titan-logout-btn:hover {
  border-color: var(--titan-forge-gold);
  color: var(--titan-forge-gold);
}

/* --- Titan's Gaze (Signature Element) --- */
.titan-grid-area[data-spinning]::before,
.titan-grid-area[data-spinning]::after {
  content: "";
  position: absolute;
  top: -40px;
  width: 50px;
  height: 30px;
  background: radial-gradient(ellipse at center,
    var(--titan-forge-gold) 0%,
    var(--titan-wrath-vermilion) 40%,
    transparent 70%
  );
  border-radius: 50%;
  animation: titan-gaze-appear 0.4s ease-out both,
             titan-gaze-pulse 2s ease-in-out 0.4s infinite;
  z-index: 25;
  pointer-events: none;
}

.titan-grid-area[data-spinning]::before { left: calc(50% - 80px); }
.titan-grid-area[data-spinning]::after  { right: calc(50% - 80px); }

@keyframes titan-gaze-appear {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 0.8; }
}

@keyframes titan-gaze-pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.08); opacity: 0.9; }
}

/* --- Reduced motion --- */
@media (prefers-reduced-motion: reduce) {
  .titan-reel-col.reel-spinning { animation: none; }
  .symbol-wild .titan-symbol-text { animation: none; }
  .payline-group .payline-glow { animation: none; }
  .wild-fire-burst { animation: none; }
  .spin-icon { animation: none; }
  .titan-joining { animation: none; }
}
```

- [ ] **Step 3: Clean up any empty files, verify TypeScript**

```bash
npx tsc --noEmit --pretty
```

- [ ] **Step 4: Do a full build check**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/games/titan-wrath/GameScreen.tsx src/games/titan-wrath/slot-machine.css
git commit -m "feat: Titan's Wrath GameScreen — full game integration

Co-Authored-By: Claude <noreply@anthropic.com>"
```
