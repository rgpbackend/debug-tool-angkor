# Titan's Wrath — Game UI Design Spec

**Date:** 2026-07-23
**Status:** Approved
**Source:** [GDD](https://ossworks.atlassian.net/wiki/spaces/YAM/pages/364053179) · [Backend Contract](https://ossworks.atlassian.net/wiki/spaces/YAM/pages/373031102)

---

## 1. Overview

Titan's Wrath is a 5×3 slot game with 10 fixed paylines, Greek mythology theme. This spec covers the **core gameplay** (spin, paylines, Titan Wild + Respin). Super Bet, Olympus Jackpot, History, Jackpot History are deferred to future phases.

### Scope — Core Phase

- Join game (CMD 1005), receive config
- Spin (CMD 1500): BASE + RESPIN
- 5×3 reel grid rendering from `patternGrid`
- 10 payline overlay with win animation
- Titan Wild expansion + locked reel glow
- Auto respin chain
- Win celebration (Combo/Super Combo/Mega Combo)
- Balance + Bet + Win display
- Bet level selector, Super Bet toggle
- Error handling (codes 1300–1315)

### Out of Scope (Future)

- Olympus Jackpot (Divine Tokens)
- Titan Multiplier / Titan's Wrath features
- Gameplay History + Jackpot History
- Paytable modal, sound/music toggles

---

## 2. Codebase Map

```
src/games/titan-wrath/
├── index.ts                     # export { GameScreen }
├── GameScreen.tsx                # Main game component
├── titan-protocol.ts             # Types + parsers (CMD 1005, 1500)
├── titan-session.ts              # useTitanSession — wraps useWsSession
├── slot-machine.css              # All Titan CSS
├── components/
│   ├── TitanSlotMachine.tsx      # Cabinet container
│   ├── TitanReelGrid.tsx         # 5×3 grid, patternGrid parser
│   ├── TitanPaylineOverlay.tsx   # SVG payline visualization
│   ├── TitanControls.tsx         # Spin, bet +/-, super bet, auto, menu
│   ├── TitanDisplayBox.tsx       # Balance/bet/win display (3 states)
│   ├── TitanJackpotBar.tsx       # MINI/MINOR/MAJOR/GRAND tiers
│   ├── TitanWildExpansion.tsx    # Column wild expand animation
│   ├── TitanWinCelebration.tsx   # Combo text overlay
│   ├── PaytableModal.tsx         # Symbol paytable
│   ├── MenuPopover.tsx           # Dropdown menu
│   ├── AutospinPicker.tsx        # Auto-spin count picker
│   └── BetPickerModal.tsx        # Bet level selector
└── hooks/
    ├── useAutoSpin.ts
    └── useReelSpinAnimation.ts
```

### Shared layer (reused, not modified)

| Module | Purpose |
|--------|---------|
| `src/ws/useWsSession.ts` | WebSocket session, connect/subscribe/heartbeat |
| `src/ws/frames.ts` | Frame builders (connect, join, heartbeat, jackpotPools, getBalance) |
| `src/ws/protocol.ts` | Shared types: `JoinResponsePayload`, `parseJoinResponsePayload`, `parseGameSymbols`, `JackpotTierInfo`, etc. |
| `src/ws/stomp-errors.ts` | STOMP error decoding |
| `src/ws/game-phase.ts` | Phase type |
| `src/ws/browser-ws-client.ts` | Browser WebSocket client |
| `src/hooks/useAuth.ts` | Auth (login, register, token refresh) |
| `src/hooks/useSyncRef.ts` | Ref synchronization hook |
| `src/config.ts` | Env config (API/WS URLs) |
| `src/lib/game-session-storage.ts` | Token persistence |
| `src/lib/session-utils.ts` | Session helpers |
| `src/lib/ws-session-refresh.ts` | Session refresh logic |
| `src/lib/format-bet.ts` | Bet formatting |
| `src/api/` | HTTP client, auth API, agency API |

### Registration

```typescript
// src/games.ts — add new entry
{
  id: "titan-wrath",
  name: "Titan's Wrath",
  icon: "⚡",
  agentId: "AGENCY_001",
  winSystem: "paylines",
  jackpotTiers: [
    { key: "MINI",    label: "MINI",    isStatic: false },
    { key: "MINOR",   label: "MINOR",   isStatic: false },
    { key: "MAJOR",   label: "MAJOR",   isStatic: false },
    { key: "GRAND",   label: "GRAND",   isStatic: false },
  ],
  GameScreen: TitanGameScreen,
}
```

---

## 3. Protocol — Titan-Specific (CMD 1005 & 1500 Only)

### 3.1 Constants

| Property | Value |
|----------|-------|
| Game route | `yama_01021` |
| Zone/channel | `MiniGame` |
| Grid | 5 columns × 3 rows |
| Paylines | 10 fixed |
| Money format | `double` (floating point) |

### 3.2 JOIN (1005)

**Request:**
```json
[6, "MiniGame", "yama_01021", { "cmd": 1005 }]
```

**Response fields used:**
- `symbols[]` — symbol catalog with `id`, `payouts` (keys `"3"`, `"4"`, `"5"`), `substitutes`
- `paylines[]` — 10 paylines, each `{ id, rows: number[5] }`
- `betAmounts[]` — allowed bet amounts (doubles)
- `balance` — wallet balance
- `lastRound` — last round snapshot for reconnection

### 3.3 SPIN (1500)

**Request:**
```json
[6, "MiniGame", "yama_01021", {
  "cmd": 1500,
  "betAmount": 100.0,
  "superBet": false
}]
```

**Response — Success:**
```typescript
interface TitanSpinResponse {
  cmd: 1500;
  c: 0;
  spin: {
    spinType: "BASE" | "RESPIN";
    spinIndex: number;
    patternGrid: string;              // 15-char row-major
    winAmount: number;
    paylineWins: TitanPaylineWin[];
    superBet: boolean;
    baseBet: number;
    titanWild?: {
      triggered: boolean;
      wildReels: number[];            // 0-based column indices
    };
  };
  round: {
    roundId: string;
    state: "ACTIVE" | "RESPIN" | "ENDED";
    betAmount: number;
    totalWin: number;
  };
  state: {
    titanWild: {
      active: boolean;
      spinCount: number;
      lockedReels: number[];          // all locked columns
    };
  };
}

interface TitanPaylineWin {
  paylineId: string;   // "P01"–"P10"
  symbol: string;      // winning symbol
  count: number;       // 3, 4, or 5
  winAmount: number;
  direction: "LTR" | "RTL";
}
```

**Response — Error:**
```json
[5, { "cmd": 1500, "c": 1307, "mgs": "INSUFFICIENT_BALANCE", "gid": "yama_01021" }]
```

### 3.4 Grid Parsing

```typescript
function parsePatternGrid(patternGrid: string): string[][] {
  // "AWBCDEGFABCWEFG" → grid[5][3]
  const cols = 5, rows = 3;
  const grid: string[][] = Array.from({ length: cols }, () => []);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      grid[c][r] = patternGrid[r * cols + c];
  return grid; // grid[col][row], row: 0=top,1=mid,2=bottom
}
```

### 3.5 Spin Matchers

```typescript
function isTitanSpinResponse(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1500") && payload.c === 0 && typeof payload.spin === "object";
}

function isTitanSpinError(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1500") && payload.c !== 0;
}
```

### 3.6 Error Handling

| Code | Constant | Client Action |
|------|----------|---------------|
| 1300 | INTERNAL_SERVER_ERROR | Toast + retry button |
| 1305 | SESSION_NOT_FOUND | Auto re-JOIN |
| 1307 | INSUFFICIENT_BALANCE | Show deposit modal |
| 1308 | ROUND_NOT_FOUND | JOIN, start fresh |
| 1309 | ROUND_ALREADY_ENDED | Enable spin button |
| 1310 | LOCK_NOT_ACQUIRED | Auto retry after 500ms |
| 1311 | INVALID_BET_AMOUNT | Reset bet selector |
| 1312 | INVALID_STATE_TRANSITION | Re-JOIN to re-sync |

---

## 4. Client State Machine

```
JOIN (1005) → READY → SPINNING → round.state?
                                    ├─ ENDED  → SHOW_WIN → READY
                                    └─ RESPIN → RESHOW_GRID → AUTO_SPIN_RES
                                                                  └─ SPINNING
```

**Phase tracking:** Use same `phase` pattern as shared `useWsSession` — `"joining" | "ready" | "spinning"`.

---

## 5. UI Components

### 5.1 TitanSlotMachine
Container. Dark obsidian background with subtle ember radial gradient. Houses grid, jackpot bar, display box, controls.

### 5.2 TitanReelGrid
- Parses `patternGrid` → 5 columns × 3 rows
- Symbols: A/B (High, gold), C/D/E (Mid, silver), F/G (Low, bronze), W (Wild, animated fire)
- Locked columns: Divine Amber border glow + slight scale pulse
- Spin animation: each column drops with staggered timing, blur + ease-out

### 5.3 TitanPaylineOverlay
- SVG layer absolutely positioned over grid
- 10 curved paths matching GDD payline shapes
- Winning paylines: Divine Amber glow stroke with animated dash offset (`LTR`/`RTL`)
- Win amount popup at payline midpoint

### 5.4 TitanControls
- **Spin**: circular button, ⚡ icon, Forge Gold ring glow on hover. Spinning → square stop button
- **Bet +/-**: arrow buttons flanking bet display
- **Super Bet**: toggle switch, OFF=dark, ON=Wrath Vermilion glow + badge "DOUBLE WILDS!"
- **Auto Spin**: opens picker (5/10/25/50/100/∞)
- **Menu**: ☰ opens dropdown (paytable, rules, sound, music, history — icons only, deferred)

### 5.5 TitanDisplayBox
White background, dark text (GDD requirement). 3 states:
- **Idle**: marquee scrolling "Win up to 2100x Bet · Good luck"
- **Spinning**: same marquee continues
- **Win Result**: instant transition, total win in Cinzel Display font, marquee stops immediately

### 5.6 TitanWildExpansion
When `titanWild.triggered`:
1. Target column cells flash W symbol
2. Column-wide fire burst animation (CSS: scale + opacity + filter blur → resolve)
3. Column settles as all-W with locked glow

### 5.7 TitanWinCelebration
Overlay text on grid:
- 2-3 lines → "COMBO"
- 4-5 lines → "SUPER COMBO"
- 6+ lines → "MEGA COMBO"
- Each level escalates from previous (override, not accumulate)
- Text animation: scale up + fade in, hold 1s, fade out

---

## 6. Design Tokens

### 6.1 Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Obsidian | `#0D0B0F` | Main cabinet background |
| Ember | `#1A1410` | Secondary panels, modals |
| Forge Gold | `#D4A843` | Spin button, payline wins, jackpot |
| Wrath Vermilion | `#E8452D` | Super Bet ON, wild glow |
| Divine Amber | `#F0C060` | Locked reels, multiplier text |
| Ash | `#8A8580` | Muted text, borders, disabled |
| Smoke | `#C4BFB8` | Body text on dark |

### 6.2 Typography

| Role | Font | Weights |
|------|------|---------|
| Display | Cinzel (Google Fonts) | 600, 700 |
| Body | Inter / system-ui | 400, 500 |
| Mono | JetBrains Mono | 400 (if needed) |

### 6.3 Type Scale

```
Display (Cinzel):
  .titan-title-xl     2.5rem / 700   — jackpot win, round total
  .titan-title-lg     1.75rem / 700  — section headers
  .titan-title-md     1.25rem / 600  — jackpot tier labels
  .titan-title-sm     0.875rem / 600 — payline IDs

Body (Inter):
  .titan-body-lg      1rem / 500     — balance, bet
  .titan-body-md      0.875rem / 400 — menu items, controls
  .titan-body-sm      0.75rem / 400  — captions, tooltips
```

---

## 7. Key Interactions

### 7.1 Spin Flow
1. User presses Spin → request `[6, "MiniGame", "yama_01021", { cmd: 1500, betAmount, superBet }]`
2. Phase → `"spinning"`, all controls disabled
3. Reels animate (staggered column drops, ~1.2s)
4. Response arrives → parse, update state
5. If `titanWild.triggered` → expansion animation (0.4s)
6. If `paylineWins.length > 0` → highlight paylines + combo text
7. Display box → win amount
8. If `round.state === "RESPIN"` → auto-trigger next spin after 1.5s delay
9. If `round.state === "ENDED"` → enable spin button, show totalWin

### 7.2 Super Bet Toggle
- Only changeable when `round.state !== "RESPIN"` (or round is not active)
- ON → Wrath Vermilion glow, badge appears, total bet updates (×1.5)
- Animation: brief energy beam circling the grid

### 7.3 Auto Spin
- User picks count → spin starts
- Between spins: 0.8s delay
- If respin triggers → auto-spin pauses for respin chain, resumes after `ENDED`
- Stop button or clicking grid → cancel, finish current spin

---

## 8. Signature Element: "Titan's Gaze"

During SPINNING state, two giant fiery Titan eyes appear above the grid using CSS animations:

- Pseudo-elements with radial gradients (Forge Gold → Wrath Vermilion → transparent)
- Slow scale-up + fade-in over 0.4s
- Subtle idle pulse (scale 1.0 → 1.05 every 2s)
- Disappear instantly when reels stop

This is the one bold, memorable visual choice. Everything else is disciplined.

---

## 9. Dependencies

**New:**
- `cinzel` (Google Fonts) — via `<link>` in `index.html`

**Existing (already installed):**
- `react` ^19.2.5
- `react-dom` ^19.2.5

**No new npm packages needed.**

---

## 10. Self-Review Notes

- All CMD types limited to 1005 and 1500 per user requirement
- Bet amounts displayed as dollars (e.g. $0.10–$100.00), matching GDD bet levels
- `patternGrid` parsing follows backend contract exactly (15-char row-major)
- Error handling covers all 1300-series codes from backend contract
- Win system is "paylines" (not "winways") — registered in GameDef
- No shared Angkor components reused — Titan is fully self-contained
- CSS: no CSS-in-JS dependency — plain `.css` file matching existing pattern
