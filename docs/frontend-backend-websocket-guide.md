# Frontend - Backend WebSocket Integration Guide

This document describes the basic flow for frontend clients to connect and interact with backend game service `The Last Guardian of Angkor`.

## 1) Connect

**WebSocket endpoint**

`wss://gob01-ws.relaxwmestu.xyz/websocket`

Send this message right after the socket opens:

```json
[
  1,
  "MiniGame",
  "",
  "",
  {
    "agentId": "1",
    "accessToken": "1-valid-token-001",
    "reconnect": false
  }
]
```

### Notes

- Keep all payload keys quoted with valid JSON format.
- Use `reconnect: false` for first connection.
- A reconnect can receive a new transport `sessionId`; backend session and round ownership are resolved by stable identity (`agencyId + userId`) instead of transport `sessionId`.
- `reconnect` is optional metadata and does not replace stable identity-based ownership.

## 1.1) Monetary values (wire format)

Monetary fields in JSON payloads from this game service are **plain decimal strings** with **4 fractional digits** (same scale as internal `Money` / `MonetaryWireValues`), not JSON numbers. Examples: `"1000.0000"`, `"10.0000"`, `"0.0000"`.

This applies to fields such as: `balance` (top-level on join `1005`, spin `1500`, and balance query `1530` replies), `bet`, `totalWin`, `win`, `profit`, `payout`, `jackpotWin`, and entries in `betLevels`, plus jackpot pool / history amounts where documented below.

Parse them as decimals in the client; do not assume IEEE `double` from the wire.

## 2) Join Game (Subscribe)

After connect success, subscribe to this game route:

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1005"
  }
]
```

Command payloads may use `cmd` as a JSON string (e.g. `"1005"`) or as a number (`1005`) depending on gateway conventions; both are common in plugin flows.

### Join response (`cmd: 1005`)

After a successful join, the backend pushes a WebSocket message with `cmd: 1005` containing **game config** and the player's **last round snapshot** (if any). Frontend must parse this response to initialize the game UI.

#### Response structure

```json
{
  "cmd": 1005,
  "c": 0,
  "symbols": [
    {
      "id": "A",
      "kind": "LOW_PAY",
      "payouts": { "3": "0.1", "4": "0.2", "5": "0.3" }
    },
    {
      "id": "W",
      "kind": "WILD",
      "substitutes": true
    },
    {
      "id": "GW",
      "kind": "GOLDEN_WILD",
      "substitutes": true
    },
    {
      "id": "S",
      "kind": "SCATTER"
    }
  ],
  "betLevels": ["0.1000", "0.2000", "1.0000", "10.0000"],
  "balance": "1000.0000",
  "lastRound": null
}
```

Top-level fields:

| Field       | Type             | Description                                                                                                                                                                                                                          |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cmd`       | `int`            | Command code (`1005`).                                                                                                                                                                                                               |
| `c`         | `int`            | Status code (`0` = success).                                                                                                                                                                                                         |
| `symbols`   | `object[]`       | Symbol catalog for reel rendering and paytable UI (see **Symbol object** below). Order matches backend `Symbol` enum declaration order (`A` … `S`).                                                                                  |
| `betLevels` | `string[]`       | Allowed bet amounts as decimal strings (see §1.1).                                                                                                                                                                                   |
| `balance`   | `string`         | Player's current wallet balance at join time, as a decimal string (§1.1). Top-level sibling of `symbols` / `betLevels` / `lastRound`; refresh it from each spin (`1500`) response, or on demand via the `1530` balance query (§3.2). |
| `lastRound` | `object \| null` | Snapshot of the player's most recent round with at least one spin, or `null` if the player has never played. Use `lastRound.round.isFinished` to determine if the round needs to be resumed.                                         |

#### Symbol object (`symbols[]`)

Each entry describes one symbol id used in `spin.reels` and cheat grids.

| Field         | Type                 | Description                                                                                                                                                                                      |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`          | `string`             | Symbol code (`A`–`I`, `W`, `GW`, `S`). Same values as reel cells and `winWays[].symbol` (paying symbols only use `A`–`I`).                                                                       |
| `kind`        | `string`             | `LOW_PAY`, `MID_PAY`, `HIGH_PAY`, `WILD`, `GOLDEN_WILD`, or `SCATTER`.                                                                                                                           |
| `payouts`     | `object` \| omitted  | Bet **multipliers** (Cx) for 3/4/5-of-a-kind on consecutive reels from reel 1. Keys `"3"`, `"4"`, `"5"`; values plain decimal strings (not 4-digit money scale). Omitted for `W`, `GW`, and `S`. |
| `substitutes` | `boolean` \| omitted | Present and `true` only for `W` and `GW` (substitute for paying symbols in ways evaluation; no standalone ways win).                                                                             |

**Paytable vs spin wins:** `symbols[].payouts` are static Cx multipliers for the info/paytable UI (`Final Win = ways × Cx × bet`). `spin.winWays[].payout` is the **credited money** for that way group after bet and feature multipliers (§1.1 decimal strings).

#### `lastRound` object (when present)

The backend **always** includes the last round snapshot (regardless of round state) **in the same format as a spin (1500) response body** (the inner object with `spin`, `round`, and `state` — without the join-only siblings like `symbols`). This allows the frontend to display the last grid and, when the round is unfinished (`round.isFinished == false`), **resume** the game without requiring the player to re-spin.

```json
{
  "cmd": 1005,
  "c": 0,
  "symbols": [
    {
      "id": "A",
      "kind": "LOW_PAY",
      "payouts": { "3": "0.1", "4": "0.2", "5": "0.3" }
    }
  ],
  "betLevels": ["0.1000", "1.0000"],
  "balance": "1000.0000",
  "lastRound": {
    "spin": {
      "spinType": "FREE_SPIN",
      "reels": [
        ["A", "B", "C"],
        ["D", "E", "F", "G"],
        ["A", "B", "C", "D"],
        ["E", "F", "G", "H"],
        ["S", "W", "A"]
      ],
      "win": "5.0000",
      "triggers": [],
      "winWays": [],
      "guardianWild": {
        "triggered": false,
        "originalReels": [],
        "addedPositions": []
      },
      "jackpot": {
        "triggered": false,
        "tier": null,
        "jackpotWin": "0.0000",
        "goldenWildPositions": []
      },
      "retrigger": {
        "triggered": false,
        "scatterCount": 0,
        "addedFreeSpins": 0,
        "scatterPositions": []
      }
    },
    "round": {
      "roundId": "round-abc-123",
      "state": "FREE_SPIN",
      "bet": "10.0000",
      "totalWin": "50.0000",
      "isFinished": false,
      "winCapReached": false
    },
    "state": {
      "freeSpin": {
        "active": true,
        "spinsLeft": 5,
        "preScatterCount": 3,
        "scatterCollected": 3,
        "triggeredScatterCount": 4,
        "initialFreeSpinCount": 15,
        "currentStep": 4,
        "totalSteps": 9
      },
      "respin": {
        "active": false,
        "origin": "BASE",
        "currentStep": 0,
        "totalSteps": 0,
        "spinsLeft": 0,
        "stickyWildAnchorRows": {}
      }
    }
  }
}
```

`lastRound` uses the **same** `spin` / `round` / `state` shape as a spin (1500) response. For field documentation see Section 3. Note: the top-level `balance` (above) is a join-level sibling like `symbols` / `betLevels` — it is **not** part of the `lastRound` inner object (and the live `1500` response likewise carries its own top-level `balance` sibling).

- `spin` contains the **last spin** the player performed (or `null` if the round has no spins yet). Live snapshots **do not** include a `spinId` field.
- `round` contains round-level metadata (roundId, state, bet, totalWin, isFinished, winCapReached). **Use `isFinished` to decide whether the round needs to be resumed.**
- `state` contains feature state (freeSpin + respin) — identical to spin response.

### Frontend initialization flow

1. **Read the top-level `balance`** from the join response to display the player's wallet balance immediately. Refresh it from each spin (`1500`) response's top-level `balance`; for an on-demand refresh (e.g. after reconnect) use the `1530` balance query (see §3.2). There is **no** unsolicited server-side balance push.
2. **Parse `lastRound`** from the join response.
3. **If `lastRound` is `null`**: player has never played — show normal idle UI, enable bet selection and spin button.
4. **If `lastRound` is present and `lastRound.round.isFinished == true`**: previous round is complete — display the last reel grid from `lastRound.spin.reels` as a visual context, enable bet selection and spin button for a new round.
5. **If `lastRound` is present and `lastRound.round.isFinished == false`**: player has an unfinished round — restore UI state:
   - Lock bet to `lastRound.round.bet` (player cannot change bet mid-round).
   - Show accumulated `lastRound.round.totalWin`.
   - Display the last reel grid from `lastRound.spin.reels` (if `spin` is not null).
   - Based on `lastRound.round.state`:
     - `BASE` → enable spin button for next base spin.
     - `FREE_SPIN` → show free-spin UI with `lastRound.state.freeSpin` counters, auto-spin or prompt to continue.
     - `RESPIN` → show respin UI with `lastRound.state.respin` data, auto-spin or prompt to continue.
6. **Send spin (`1500`)** to continue the round — backend will pick up from the saved state.

### Notes

- Do not allow spin before join succeeds.
- If join fails, show user-friendly error and retry option.
- The `lastRound` object (when not null) matches the **spin response body's** `spin` / `round` / `state` structure. Frontend can reuse the same parsing/rendering logic for both.

## 3) Spin

Send spin command:

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1500",
    "bet": "1"
  }
]
```

### Notes

- `bet` must be a value the backend can parse as a decimal (string recommended; server reads it via decimal string conversion).
- `bet` should be validated on frontend before sending (must be one of `betLevels` from join / config).
- Disable spin button while waiting for spin response to avoid duplicate requests.

### Spin response structure

Spin response returns a **session snapshot** with the following top-level fields:

- `spin`: current spin result
- `round`: round-level snapshot
- `state`: feature snapshot + UI flags
- `balance`: player's wallet balance **after** this spin's win/lose settlement (decimal string, §1.1)

Example:

```json
{
  "spin": {
    "spinType": "BASE",
    "reels": [
      ["A", "B", "C"],
      ["D", "E", "F", "G"],
      ["A", "B", "C", "D"],
      ["E", "F", "G", "H"],
      ["S", "W", "A"]
    ],
    "win": "10.0000",
    "triggers": ["FREE_SPIN"],
    "guardianWild": {
      "triggered": true,
      "originalReels": [
        ["A", "B", "C"],
        ["D", "E", "F", "G"],
        ["A", "B", "C", "D"],
        ["E", "F", "G", "H"],
        ["S", "A", "A"]
      ],
      "addedPositions": [[4, 1]]
    },
    "winWays": [
      {
        "symbol": "A",
        "matchCount": 4,
        "ways": 12,
        "payout": "4.8000",
        "positions": [[0, 2], [1], [0, 2, 3], [2]]
      }
    ],
    "jackpot": {
      "triggered": false,
      "tier": null,
      "jackpotWin": "0.0000",
      "goldenWildPositions": []
    },
    "retrigger": {
      "triggered": false,
      "scatterCount": 0,
      "addedFreeSpins": 0,
      "scatterPositions": []
    }
  },
  "round": {
    "roundId": "round-001",
    "state": "FREE_SPIN",
    "bet": "1.0000",
    "totalWin": "10.0000",
    "isFinished": false,
    "winCapReached": false
  },
  "state": {
    "freeSpin": {
      "active": true,
      "spinsLeft": 9,
      "preScatterCount": 2,
      "scatterCollected": 3,
      "triggeredScatterCount": 3,
      "initialFreeSpinCount": 10,
      "currentStep": 0,
      "totalSteps": 9
    },
    "respin": {
      "active": false,
      "origin": "BASE",
      "currentStep": 0,
      "totalSteps": 0,
      "spinsLeft": 0,
      "stickyWildAnchorRows": {}
    }
  },
  "balance": "1009.0000"
}
```

| Field     | Type     | Description                                                                                                                                                                                                                                                                     |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spin`    | `object` | Current spin result (see fields below). No `spinId` in live spin snapshots.                                                                                                                                                                                                     |
| `round`   | `object` | Round-level snapshot. See **Round object fields** table below.                                                                                                                                                                                                                  |
| `state`   | `object` | Feature state (freeSpin + respin).                                                                                                                                                                                                                                              |
| `balance` | `string` | Player's wallet balance **after** this spin's win/lose settlement (decimal string, §1.1). Top-level sibling of `spin`/`round`/`state`. The intermediate post-`BET` balance during a base spin is **not** delivered as a separate event; only this post-settle snapshot is sent. |

#### Round object fields (`round`)

| Field           | Type      | Description                                                                                                     |
| --------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `roundId`       | `string`  | Unique identifier for this round.                                                                               |
| `state`         | `string`  | Current round state: `BASE` \| `RESPIN` \| `FREE_SPIN` \| `END`.                                                |
| `bet`           | `string`  | Bet amount as a decimal string (§1.1).                                                                          |
| `totalWin`      | `string`  | Accumulated total win for this round as a decimal string (§1.1).                                                |
| `isFinished`    | `boolean` | `true` when the round is in `END` state — no further spins allowed.                                             |
| `winCapReached` | `boolean` | `true` when the round win cap (`bet × 15000`) has been hit during this round. See **§3.3 Win Cap** for details. |

Use `round.state` as the canonical progression enum value:
`BASE`, `RESPIN`, `FREE_SPIN`, `END`.

Progressive jackpot **"The Guardian's Eye"** resolves in the **same** spin as a base game outcome (no separate `JACKPOT` round state). When hit, `spin.jackpot.triggered` is `true`, and the round ends (`round.state` → `END`).

**Jackpot vs Guardian Wild (same spin):** on a **BASE** spin, if the jackpot triggers, the backend does **not** run the Guardian Wild random roll / apply path for that same spin. If jackpot does not trigger, Guardian Wild may still run as usual.

**Jackpot tier selection:** the winning tier is chosen server-side using configurable tier weights (normalized internally); clients should rely on `spin.jackpot.tier` only.

### Spin triggers (`spin.triggers`)

- `BASE` activation into free spins still uses `spin.triggers` containing `"FREE_SPIN"` (same as before).
- During `FREE_SPIN`, when `spin.retrigger.triggered` is `true`, the backend also appends `"FREE_SPIN"` to `spin.triggers` so the client can reuse the same trigger handling as on initial activation. Retrigger details remain authoritative on `spin.retrigger`.

### Feature snapshot: `state.respin`

Sent on every spin response (see `GameResponseBuilder.buildStateSnapshot`). Fields:

| Field                  | Meaning                                                                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`               | `true` while at least one reel is still in the sticky wild expansion set.                                                                                                                                                                      |
| `origin`               | `BASE` or `FREE`. When no respin is in progress, backend still sends `BASE`.                                                                                                                                                                   |
| `currentStep`          | Round-level count of completed respin substeps since the respin trigger (`0` right after trigger). Increments once per `RESPIN` spin.                                                                                                          |
| `totalSteps`           | Dynamic upper bound: `currentStep` plus remaining substeps implied by the slowest sticky reel (`max` over reels of `rowCount − expansionStep + 1`). When no reel is sticky, equals `currentStep` (chain ended). When idle / no chain yet, `0`. |
| `spinsLeft`            | Remaining respin substeps for current chain, computed as `max(0, totalSteps - currentStep)`. Useful for frontend countdown/progress display.                                                                                                   |
| `stickyWildAnchorRows` | Map (JSON object) with **string** reel indices → anchor row index (top = `0`) for that reel’s sticky Wild.                                                                                                                                     |

### Feature snapshot: `state.freeSpin`

Sent on every spin response (see `GameResponseBuilder.buildStateSnapshot`). Fields:

| Field                   | Meaning                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`                | `true` while the free-spin session is active (`spinsLeft > 0`).                                                                                    |
| `spinsLeft`             | Remaining free spins in the current session.                                                                                                       |
| `preScatterCount`       | `scatterCollected` **before** the current spin applied scatter collection for this response. Use with `scatterCollected` to animate counter steps. |
| `scatterCollected`      | Accumulated scatters collected during the session (used for Guardian Wild milestone logic).                                                        |
| `triggeredScatterCount` | Scatter count that triggered the initial `BASE` → `FREE_SPIN` activation (unchanged by retriggers).                                                |
| `initialFreeSpinCount`  | Free spin count granted at the initial `BASE` → `FREE_SPIN` activation, before any retriggers. Based on `triggeredScatterCount`: 3→10, 4→15, 5→20. |
| `currentStep`           | Number of completed **FREE_SPIN** spins in this round since entering FREE_SPIN (counts `SpinType.FREE_SPIN` in `round.spins`). `0` right on entry. |
| `totalSteps`            | Progress upper bound for this session: `currentStep + spinsLeft`. When `active == false`, backend sends `0`.                                       |

### Win ways payload

- `spin.winWays` lives inside the `spin` object (same level as `spinType`, `reels`, `win`, `triggers`).
- `winWays[i].symbol` is always a regular paying symbol (`A`-`I`). `W` and `GW` are substitutes only and never appear as standalone win-way symbols.
- Each win way must include at least one **native** cell of that symbol in the matched reel prefix; a prefix made only of `W`/`GW` substitutes does not pay for that symbol.
- `positions` is reel-major and 0-based (`positions[i]` is list of winning row indexes on reel `i`).
- `payout` is per-way-group payout after feature multiplier (for example free-spin x2), as a **decimal string** (§1.1).
- `spin.win` is still the canonical credited amount. When win-cap is hit (see **§3.3**), `sum(winWays.payout)` parsed as decimals can be greater than `spin.win`.

### Guardian Wild payload

- `spin.guardianWild` is always present in each spin response (do not read from `state`).
- `spin.guardianWild.triggered`: feature activation flag for current spin.
- `spin.guardianWild.originalReels`: original grid before Guardian Wild overrides. Empty array when not triggered.
- `spin.guardianWild.addedPositions`: list of `[reelIndex,rowIndex]` where Wild was injected. Empty array when not triggered.

### Progressive jackpot payload (`spin.jackpot`)

- Always present on every spin response.
- `triggered`: `true` when this base spin awarded a jackpot (same-spin resolution).
- `tier`: `NANO` | `CYBER` | `GUARDIAN` | `ETERNAL`, or `null` when not triggered.
- `jackpotWin`: credited jackpot portion for this spin (not subject to the round win cap — see **§3.3**), as a **decimal string** (§1.1).
- `goldenWildPositions`: list of `[reelIndex, rowIndex]` cells painted as `GW` for this jackpot outcome; empty when not triggered.
- `spin.triggers` no longer includes `JACKPOT`; use only `spin.jackpot.triggered` as jackpot signal.

Payload shape reminder: at the **root** of the spin response object you have sibling keys `spin`, `round`, and `state`. Jackpot fields live only at **`spin.jackpot`** — not under `state.spin` (that path does not exist).

### Spin errors

When a command fails, the backend publishes an **error envelope** on the same per-session topic, reusing the request `cmd`:

```json
{
  "cmd": 1500,
  "c": 1,
  "msg": "Wallet BET rejected for round round-001 (code=607)",
  "errorCode": "BALANCE_NOT_ENOUGH"
}
```

- `c` is `1` (non-zero) on error; success responses use `c: 0`.
- `errorCode` is a stable enum string; `msg` is human-readable and may change.

Error codes relevant to spin (`1500`):

| `errorCode`                | Meaning / frontend handling                                                                                                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_BET_AMOUNT`       | `bet` is not in `betLevels`, or does not match the locked bet of an unfinished round. Fix the bet and resend.                                                                                                                                                                                       |
| `BALANCE_NOT_ENOUGH`       | Wallet rejected the BET debit (insufficient balance). Show a top-up prompt; the round was not consumed.                                                                                                                                                                                             |
| `BALANCE_OPERATION_FAILED` | Wallet rejected the operation (account/operation error). Surface an error; safe to retry later.                                                                                                                                                                                                     |
| `WALLET_TRANSFER_ERROR`    | Wallet transfer failed (transport or unknown rejection). Safe to retry — wallet operations are idempotent per transaction id.                                                                                                                                                                       |
| `ROUND_SETTLE_PENDING`     | A previous spin's win/lose settlement is still **pending** (wallet or process failure after the result was persisted). The spin result is durable server-side; the backend **replays** the settlement automatically on each new spin request. Show a transient error and let the player retry spin. |

**Pending settle behavior (`ROUND_SETTLE_PENDING`):** the backend persists every spin result **before** calling the wallet. If the wallet settle fails (or the backend crashes mid-settle), the result is never lost or re-rolled: the next spin request first replays the pending settlement with the same transaction id and amount, then proceeds with the new spin. While the replay keeps failing, spin requests are rejected with `ROUND_SETTLE_PENDING` — the frontend just retries (no special recovery flow is needed client-side; the persisted result is visible via `lastRound` on re-join and in game history once the round finishes).

## 3.1) Jackpot broadcast (server push)

The backend pushes jackpot updates to **all online players in the same zone** when **any** player completes a **base spin** (the round was in `BASE` state before that spin). These messages use the same WebSocket response envelope as spin/join (`[5, { ... }]` with `cmd` and `c: 0`). **Clients do not send these commands** — only listen and update UI.

Not sent on free-spin or respin spins.

### When events fire

| Event          | `cmd`  | Trigger                                                                                                                |
| -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Pool snapshot  | `1520` | After every player's base spin (progressive pools update; snapshot includes all **4** active tiers)                    |
| Jackpot winner | `1521` | Same base spin when that player won a jackpot tier (`spin.jackpot.triggered` would be `true` on their `1500` response) |

### JACKPOT_POOLS_UPDATED (`1520`)

Same `pools` array shape as **GET_JACKPOT_POOLS** (`1510`) — see §4.2.

Example (inner object after `[5, ...]`):

```json
{
  "cmd": 1520,
  "c": 0,
  "pools": [
    {
      "poolId": "POOL-abc",
      "tier": "GUARDIAN",
      "status": "ACTIVE",
      "seedAmount": "500.0000",
      "currentAmount": "512.3400",
      "createdAt": 1715760000000
    }
  ]
}
```

| Field per pool  | Type     | Description                                      |
| --------------- | -------- | ------------------------------------------------ |
| `poolId`        | `string` | Active pool id for this tier.                    |
| `tier`          | `string` | `NANO` \| `CYBER` \| `GUARDIAN` \| `ETERNAL`.    |
| `status`        | `string` | `ACTIVE` (broadcast only includes active pools). |
| `seedAmount`    | `string` | Decimal string (§1.1).                           |
| `currentAmount` | `string` | Decimal string (§1.1).                           |
| `createdAt`     | `number` | Epoch milliseconds.                              |

### JACKPOT_WINNER (`1521`)

Announces that a player won a jackpot on a base spin.

```json
{
  "cmd": 1521,
  "c": 0,
  "tier": "GUARDIAN",
  "winAmount": "1234.5678",
  "userId": "player-uid",
  "agencyId": 100,
  "roundId": "round-abc-123",
  "poolId": "POOL-new-after-reseed",
  "occurredAt": 1715760000000
}
```

| Field        | Type     | Description                                                                  |
| ------------ | -------- | ---------------------------------------------------------------------------- |
| `tier`       | `string` | Won tier (`NANO` \| `CYBER` \| `GUARDIAN` \| `ETERNAL`).                     |
| `winAmount`  | `string` | Credited jackpot amount, decimal string (§1.1).                              |
| `userId`     | `string` | Winner's user id.                                                            |
| `agencyId`   | `number` | Winner's agency id.                                                          |
| `roundId`    | `string` | Round id of the winning spin.                                                |
| `poolId`     | `string` | **New** active pool id for that tier after reseed (matches post-win `1520`). |
| `occurredAt` | `number` | Epoch milliseconds.                                                          |

For the **closed** pool that was won, use **GET_JACKPOT_WIN_HISTORY** (`1511`) or the winner's own `1500` response (`spin.jackpot`).

### Frontend handling

1. Register handlers for `cmd === 1520` and `cmd === 1521` alongside spin/join handlers.
2. On `1520`, refresh jackpot meter UI from `pools` (key by `tier`).
3. On `1521`, show a global winner feed / celebration; merge with `1520` if both arrive together.
4. The **spinning** player still receives their own `1500` with `spin.jackpot` — use broadcast so **other** clients see pool ticks and winners in real time.

Delivery is server-side (plugin-topic or per-session fan-out in zone); subscribed clients on the game route receive these pushes the same way as other game messages.

## 3.2) Wallet balance query (`1530`) — client → server

Wire code `1530` (**GET_BALANCE**) is a **client-callable query only**. There is **no** unsolicited server-side balance push: balance changes from gameplay are carried by the top-level `balance` field on join (`1005`) and spin (`1500`) responses.

The frontend can request the current balance at any time (e.g. after reconnect, tab refocus, or to reconcile the wallet UI) by sending the standard game envelope with `cmd 1530` and no other fields:

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1530"
  }
]
```

The backend resolves the player from the active session and replies on the per-session topic (`urn:ws:z:<zone>:s:<sessionId>`):

```json
{
  "cmd": 1530,
  "c": 0,
  "balance": "1000.0000",
  "reason": "QUERY",
  "roundId": null,
  "timestampMillis": 1715760000000
}
```

| Field             | Type     | Description                                             |
| ----------------- | -------- | ------------------------------------------------------- |
| `balance`         | `string` | Player's current wallet balance (decimal string, §1.1). |
| `reason`          | `string` | Always `QUERY`.                                         |
| `roundId`         | `null`   | Always `null` (the query is not tied to a round).       |
| `timestampMillis` | `number` | Epoch milliseconds when the reply was built.            |

If the wallet lookup fails, the backend replies with the error envelope (see **Spin errors** in §3) using `errorCode: "BALANCE_OPERATION_FAILED"`.

### Frontend handling

1. Initialize the wallet display from the join (`1005`) top-level `balance`.
2. Refresh it from each spin (`1500`) top-level `balance` — the post-settle snapshot for that spin.
3. To **actively refresh** (e.g. after reconnect or tab refocus), send `{cmd:"1530"}` and update the display from the reply. Treat it as a silent refresh (no debit/credit animation).
4. There is no separate intermediate post-`BET` balance event during a base spin; only the final post-settle balance arrives on the `1500` response.

## 3.3) Win Cap

Total win per round (BASE + RESPIN + FREE_SPIN accumulated) is capped at **`bet × 15000`** (`winCapMultiplier`, backend-configurable).

- **Jackpot wins are exempt**: `spin.jackpot.jackpotWin` is paid from the jackpot pool, outside game-math RTP, and is never reduced by the cap.
- When a spin's win would push the round total past the cap, `spin.win` is **reduced** to the remaining room (it can be `"0.0000"` when the cap was already reached) and `round.winCapReached` becomes `true`.
- Reaching the cap **force-ends** the round only in `FREE_SPIN` (`round.state` → `END`); `BASE` and `RESPIN` flows continue with the capped win.
- Because the cap reduces `spin.win` but not the per-way breakdown, `sum(winWays[].payout)` can exceed `spin.win` on the capped spin — `spin.win` is the canonical credited amount.

## 4) Config, jackpot queries, and force jackpot (QA)

Same WebSocket envelope as other game commands: channel `MiniGame`, route `game-the-last-guardian-of-angkor`, payload object with `cmd`.

### Command codes

| `cmd`    | Purpose                                                                      |
| -------- | ---------------------------------------------------------------------------- |
| `"1501"` | **GET_CONFIG** — `symbols` and `betLevels` only (same as join config).       |
| `"1510"` | **GET_JACKPOT_POOLS** — active pool amounts per tier (client pull).          |
| `"1511"` | **GET_JACKPOT_WIN_HISTORY** — recent jackpot wins.                           |
| `"1512"` | **GET_JACKPOT_CONTRIBUTION_HISTORY** — recent contributions.                 |
| `1520`   | **JACKPOT_POOLS_UPDATED** — server push only; see §3.1.                      |
| `1521`   | **JACKPOT_WINNER** — server push only; see §3.1.                             |
| `"1530"` | **GET_BALANCE** — client-callable balance query (no server push) — see §3.2. |
| `"2002"` | **FORCE_JACKPOT_NEXT_SPIN** — QA only; requires cheat feature enabled.       |

### 4.1) GET_CONFIG (`1501`)

No required fields beyond `cmd`.

Response body:

- `symbols` — `object[]` (same **Symbol object** shape as join `1005`; see §2)
- `betLevels` — `string[]` (decimal strings, §1.1)

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1501"
  }
]
```

### 4.2) GET_JACKPOT_POOLS (`1510`)

Response body:

- `pools` — array of objects: `poolId`, `tier`, `status`, `seedAmount`, `currentAmount` (decimal strings), `createdAt` (epoch milliseconds).

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1510"
  }
]
```

### 4.3) GET_JACKPOT_WIN_HISTORY (`1511`)

Optional: `limit` — integer, clamped between **1** and **100**, default **50**.

Response body:

- `items` — each row: `id`, `poolId`, `tier`, `roundId`, `userId`, `agencyId`, `betAmount`, `winAmount`, `poolAmountAtWin` (decimal strings), `goldenWildPositions` (array of `{ "reelIndex": int, "rowIndex": int }` — **object form**, not `[reel, row]` tuples), `createdAt` (epoch ms).
- `count` — number of items returned.

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1511",
    "limit": 20
  }
]
```

### 4.4) GET_JACKPOT_CONTRIBUTION_HISTORY (`1512`)

Optional: `limit` — same rules as `1511`.

Response body:

- `items` — each row: `id`, `poolId`, `tier`, `roundId`, `userId`, `agencyId`, `betAmount`, `contributionAmount`, `poolAmountBefore`, `poolAmountAfter` (decimal strings), `createdAt` (epoch ms).
- `count` — number of items returned.

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1512",
    "limit": 50
  }
]
```

### 4.5) FORCE_JACKPOT_NEXT_SPIN (`2002`)

Arms the next applicable **base** spin to evaluate jackpot with probability 1 (QA) and forces a **specific tier**. Rejected with an application error if **cheat / QA features are disabled** in backend config (same gate as cheat `2001`).

Payload fields:

| Field  | Type   | Required | Description                                                                              |
| ------ | ------ | -------- | ---------------------------------------------------------------------------------------- |
| `cmd`  | string | yes      | `"2002"`                                                                                 |
| `tier` | string | yes      | Jackpot tier to force. One of `NANO`, `CYBER`, `GUARDIAN`, `ETERNAL` (case-insensitive). |

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "2002",
    "tier": "GUARDIAN"
  }
]
```

Validation errors:

- Missing/blank `tier` → `tier is required, expected one of [NANO, CYBER, GUARDIAN, ETERNAL]`.
- Unknown `tier` → `Invalid tier: <value>, expected one of [NANO, CYBER, GUARDIAN, ETERNAL]`.

On success, response includes at least `c` (e.g. `0`), the canonical `tier` (uppercase, e.g. `GUARDIAN`), and a `msg` such as `Force jackpot armed for next spin: GUARDIAN`. The next base spin for that player is guaranteed to trigger jackpot at the requested tier and the arm flag is consumed (single-use).

## 5) Cheat (for QA / test flow)

Cheat is used to predefine the **next spin grid**.
Recommended for QA and scenario testing only (not for production user flow).

### Cheat command

`cmd = "2001"`

### Cheat payload format

`reels` must contain exactly 5 reels with shape `[3,4,4,4,3]`.
Each symbol must be valid in backend enum: `A,B,C,D,E,F,G,H,I,W,GW,S`.

Example:

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "2001",
    "reels": [
      ["W", "A", "B"],
      ["S", "A", "B", "C"],
      ["C", "D", "E", "F"],
      ["D", "E", "F", "G"],
      ["E", "F", "G"]
    ]
  }
]
```

### Cheat usage flow

1. Connect
2. Join game
3. Send cheat command (`2001`)
4. Send spin command (`1500`)
5. Validate returned grid/result against expected scenario

### Important behavior

- Cheat is one-time use for the next applicable spin.
- Backend consumes cheat data after use.
- If cheat feature is disabled in backend config, command `2001` is **rejected**. Command **`2002` (force jackpot)** uses the same cheat-feature gate.

## 6) Recommended frontend state flow

Use a simple state machine:

- `DISCONNECTED -> CONNECTING -> CONNECTED -> JOINED -> SPINNING -> JOINED`

For cheat test:

- `JOINED -> CHEAT_SET -> SPINNING -> JOINED`

## 7) Error handling checklist

- Add request timeout (example: 8-10 seconds).
- Handle socket close and retry with backoff.
- Re-join game after reconnect before allowing spin.
- Log outbound/inbound messages for QA investigation.

## 8) Game history (read-only)

Use the **same WebSocket envelope** as spin and join: channel `MiniGame`, route `game-the-last-guardian-of-angkor`, payload object includes `cmd` plus parameters. Backend resolves the player from the **active session** (same as other plugin calls). Call history only when it makes sense in UX (for example after join success, and not while a spin request is in flight if your UI serializes requests).

### Command codes

| `cmd`    | Purpose                                                                 |
| -------- | ----------------------------------------------------------------------- |
| `"1502"` | **Level 1** — list finished **spins** (flattened from rounds in `END`). |
| `"1503"` | **Level 2** — detail of **one** spin step inside a finished round.      |

Use string `cmd` values in JSON to match other sections in this guide where convenient; numeric `cmd` is also accepted when the gateway forwards it as a number.

### 8.1) Level 1 — list (`cmd`: `"1502"`)

**Optional fields** (all numbers unless noted):

- `page` — 1-based page number (default `1`, must be ≥ `1`).
- `size` — page size (default `6`, minimum `1`, maximum `100`). Values outside `[1, 100]` are rejected by the server.

The list includes only finished spins from rounds in `END` whose parent round `finishedAt` falls within **30 days** before the player’s most recent finished round (`finishedAt` of the latest `END` round). `totalItems` and `totalPage` describe that filtered set only.

Minimal example (first page, default page size):

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1502"
  }
]
```

With explicit pagination:

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1502",
    "page": 1,
    "size": 6
  }
]
```

**Response body** (object your client parses from the game response):

- `items` — one entry per **spin** (only rounds in `END` for the current user within the 30-day window), each with:
  - `roundId`, **`spinIndex`** (0-based index of this spin within its parent round — use with Level 2),
  - `transactionId` (currently **same as** `roundId`; may change when shared transaction id for free-spin chains is implemented),
  - `spinType` — `BASE` | `FREE_SPIN` | `RESPIN`,
  - `stepIndex` — 0-based index of this spin within its parent round (aligned with `spinIndex` for list rows),
  - `totalStepsInRound` — total number of spin steps in the parent round (`spins.length`); use with `stepIndex` for progress display, e.g. `(stepIndex + 1) / totalStepsInRound`,
  - `timestampMillis` — parent round `finishedAt` (epoch ms), not a per-spin instant; within the same round, list order follows spin order (newer rounds first; tie-break by spin index).
  - `bet`, `win`, `profit` — **per spin step** as **decimal strings** (§1.1): only the **BASE** step carries the round stake; free spin and respin steps use `"0.0000"` bet; `profit` is win minus step bet for that row.
  - `jackpot` — `{ triggered, tier, jackpotWin, goldenWildPositions }`, same contract as live spin (`1500`). When jackpot is triggered, reconcile with `sum(winWays[].payout) + jackpot.jackpotWin == win`.
- `page`, `size`, `totalPage`, `totalItems` — echo `page` (1-based, same as request) / `size`; `totalItems` is the total spin count in the 30-day window; `totalPage` is `ceil(totalItems / size)` (or `0` when `totalItems` is `0`). Requesting a `page` greater than `totalPage` returns `items: []` without error.

There is **no** `spinId` field in Level 1 list rows.

### 8.2) Level 2 — detail (`cmd`: `"1503"`)

**Required:** `roundId` (string) and **`spinIndex`** (0-based integer) — use the values from the Level 1 row the user selected (`spinIndex` from that row).

```json
[
  6,
  "MiniGame",
  "game-the-last-guardian-of-angkor",
  {
    "cmd": "1503",
    "roundId": "round-abc-123",
    "spinIndex": 0
  }
]
```

**Response body:** fields for a **single** spin step plus parent context at the root:

- `roundId`, `transactionId` (same as `roundId` until shared transaction ids exist), `finishedAtMillis` (parent round `finishedAt`, same as list `timestampMillis`). Detail is only returned when that round lies in the same 30-day window as Level 1; otherwise the server responds as spin not found.
- **`spinIndex`**, `stepIndex` (both 0-based, same value for this response), `totalStepsInRound` (total spin steps in the parent round; display progress as `(stepIndex + 1) / totalStepsInRound`),
- `spinType` — `BASE` | `FREE_SPIN` | `RESPIN`,
- `bet` — only the **BASE** step carries the round stake; free spin and respin use `"0.0000"`,
- `win`, `profit` — decimal strings (§1.1),
- `reels` — array of **columns** (each column is an array of symbol name strings); same column-major idea as live spin payloads,
- `winWays` — array of `{ wayIndex, symbol, matchCount, ways, payout, positions }`; `payout` is a decimal string; `positions` is reel-major like live spin `winWays`.
- `jackpot` — `{ triggered, tier, jackpotWin, goldenWildPositions }`, same contract as live spin (`1500`). When jackpot is triggered, reconcile with `sum(winWays[].payout) + jackpot.jackpotWin == win`.

There is **no** `spins` array and **no** `spinId` in this response. There is **no** `round` integer step field here (unlike the removed legacy field); do not confuse with the **`round` object** on live spin (1500) responses in Section 3.
