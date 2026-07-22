# Game Isolation Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure codebase so each game is a fully independent module. Changing one game never breaks the other.

**Architecture:** Shared WS lifecycle hook (`useWsSession`) + per-game modules (`src/games/<id>/`) each with their own `GameScreen`, `useGameSession`, components, and lib. App routes to game by `game.id`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Cloudflare Pages

## Global Constraints

- English-only codebase; communicate with user in Vietnamese
- No backward-compatible code: remove, don't deprecate
- Surgical changes: don't refactor unrelated code
- No test suite exists; verify by running `npm run dev` and driving the UI

---

## File Structure After Migration

```
src/
├── ws/
│   ├── browser-ws-client.ts    # unchanged
│   ├── frames.ts               # unchanged
│   ├── protocol.ts             # unchanged
│   ├── stomp-errors.ts         # unchanged
│   ├── game-phase.ts           # unchanged
│   └── useWsSession.ts         # ★ NEW — shared WS lifecycle
├── api/                        # unchanged
├── hooks/
│   ├── useAuth.ts              # ★ NEW — auth operations extracted from useGameSession
│   ├── useAutoSpin.ts          # moved to Angkor (Angkor-only)
│   ├── useRoundRunner.ts       # moved to Angkor (Angkor-only)
│   ├── useReelStripMotion.ts   # moved to Angkor (Angkor-only)
│   └── useSyncRef.ts           # unchanged (shared)
├── lib/
│   ├── game-session-storage.ts # unchanged
│   ├── ws-session-refresh.ts   # unchanged
│   ├── format-bet.ts           # unchanged
│   └── ...                     # files moved to per-game lib/
├── games/
│   ├── game-the-last-guardian-of-angkor/
│   │   ├── index.ts
│   │   ├── GameScreen.tsx
│   │   ├── useGameSession.ts
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
│   └── yama_01021/
│       ├── index.ts
│       ├── GameScreen.tsx
│       ├── useGameSession.ts
│       ├── lib/
│       │   ├── reel-spin.ts
│       │   ├── paylines.ts
│       │   ├── celebrations.ts
│       │   └── celebration-timing.ts
│       └── components/
│           ├── TitanCabinet.tsx
│           ├── PaylineReelGrid.tsx
│           ├── TitanReelColumn.tsx
│           ├── TitanControls.tsx
│           ├── TitanCelebrationOverlay.tsx
│           ├── ComboOverlay.tsx
│           ├── SuperBetToggle.tsx
│           ├── AutoSpinPicker.tsx
│           ├── TitanHistoryModal.tsx
│           └── TitanJackpotWinnersModal.tsx
├── screens/
│   ├── LobbyScreen.tsx
│   ├── LoginScreen.tsx
│   └── RegisterScreen.tsx
├── App.tsx
├── App.css
├── config.ts
├── games.ts
└── main.tsx
```

---

### Task 1: Extract `useAuth` hook from `useGameSession`

**Files:**
- Create: `src/hooks/useAuth.ts`
- Modify: `src/App.tsx` (in later task)

**Interfaces:**
- Produces: `useAuth()` returning `{ agencyUserToken, login, register, logout, depositFunds, ... }`

- [ ] **Step 1: Create `src/hooks/useAuth.ts`**

Extract auth-related operations that don't depend on WebSocket. Copy these pieces from `useGameSession`:

```ts
// src/hooks/useAuth.ts
import { useCallback, useState } from "react";
import { login as loginAgency, register, deposit, playGame } from "../api/agency";
import { refreshSessionToken } from "../api/auth";
import {
  clearGameSession,
  loadAgencyUserToken,
  loadRefreshToken,
  loadLaunchedGameId,
  saveAgencyUserToken,
  saveRefreshToken,
  saveLaunchedGameId,
} from "../lib/game-session-storage";

const DEPOSIT_AMOUNT = 10_000;
const DEPOSIT_BALANCE_CAP = 50_000;

export function useAuth() {
  const [agencyUserToken, setAgencyUserToken] = useState<string>(
    () => loadAgencyUserToken() ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  const doLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
    const u = username.trim();
    if (!u || !password) { setError("Username and password are required"); return false; }
    setError(null);
    setAuthSuccessMessage(null);
    setBusy(true);
    try {
      const { token } = await loginAgency({ username: u, password });
      saveAgencyUserToken(token);
      setAgencyUserToken(token);
      return true;
    } catch (e) {
      clearGameSession();
      setAgencyUserToken("");
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally { setBusy(false); }
  }, []);

  const doRegister = useCallback(async (username: string, password: string, displayName: string): Promise<boolean> => {
    const u = username.trim();
    const d = displayName.trim();
    if (!u || !password || !d) { setError("Username, password, and display name are required"); return false; }
    setError(null);
    setAuthSuccessMessage(null);
    setBusy(true);
    try {
      await register({ username: u, password, displayName: d });
      setAuthSuccessMessage("Account created successfully. Sign in to play.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally { setBusy(false); }
  }, []);

  const doLogout = useCallback(() => {
    clearGameSession();
    setAgencyUserToken("");
    setError(null);
  }, []);

  const doDeposit = useCallback(async (currentBalance: string | null) => {
    const token = agencyUserToken.trim();
    const bal = currentBalance ? Number(currentBalance) : NaN;
    if (!token || !Number.isFinite(bal) || bal >= DEPOSIT_BALANCE_CAP || depositBusy) return;
    setDepositBusy(true);
    setError(null);
    try {
      await deposit(token, { amount: String(DEPOSIT_AMOUNT) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setDepositBusy(false); }
  }, [agencyUserToken, depositBusy]);

  const doPlayGame = useCallback(async (gameId: string): Promise<{ token: string; refreshToken: string } | null> => {
    const token = agencyUserToken.trim();
    if (!token) { setError("Not logged in"); return null; }
    setError(null);
    setBusy(true);
    try {
      const result = await playGame(token, gameId);
      saveRefreshToken(result.refreshToken);
      saveLaunchedGameId(gameId);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally { setBusy(false); }
  }, [agencyUserToken]);

  const doRefreshAndGetToken = useCallback(async (): Promise<{ accessToken: string; gameId: string } | null> => {
    const rt = loadRefreshToken();
    const gid = loadLaunchedGameId();
    if (!rt || !gid) return null;
    try {
      const { accessToken, refreshToken: nextRt } = await refreshSessionToken(rt);
      saveRefreshToken(nextRt);
      return { accessToken, gameId: gid };
    } catch {
      clearGameSession();
      setAgencyUserToken("");
      return null;
    }
  }, []);

  return {
    agencyUserToken, error, setError,
    authSuccessMessage, setAuthSuccessMessage,
    depositBusy,
    busy, // true during login/register/playGame
    login: doLogin,
    register: doRegister,
    logout: doLogout,
    deposit: doDeposit,
    playGame: doPlayGame,
    refreshAndGetToken: doRefreshAndGetToken,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit 2>&1 | head -20
```

Expected: No errors in `useAuth.ts`. May have errors elsewhere since `useGameSession` still has the old code — that's fine, fixed in later tasks.

---

### Task 2: Extract `useWsSession` — shared WS lifecycle hook

**Files:**
- Create: `src/ws/useWsSession.ts`

**Interfaces:**
- Produces: `useWsSession(wsUrl, gameId, agentId, jackpotTierInfo, timeoutMs)` → WS lifecycle state + operations

- [ ] **Step 1: Create `src/ws/useWsSession.ts`**

Extract WS lifecycle from `useGameSession`: BrowserWsClient creation, connect, auth frame, join, heartbeat, session token refresh, disconnect, token ban handling, jackpot pools push listeners, balance refresh. Does NOT include spin, cheat, history, auto-spin, round runner, celebrations.

```ts
// src/ws/useWsSession.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWsSessionRefreshIntervalMs } from "../lib/ws-session-refresh";
import { refreshSessionToken } from "../api/auth";
import { loadRefreshToken, saveRefreshToken, clearGameSession } from "../lib/game-session-storage";
import { readEnvDefaults } from "../config";
import {
  BrowserWsClient,
  StompTokenBannedError,
  isJoinResponsePayload,
  isJackpotPoolsPayload,
  isJackpotPoolsPushPayload,
  isJackpotWinnerPush,
  isGetBalanceResponsePayload,
  isGetBalanceErrorPayload,
} from "./browser-ws-client";
import { connectFrame, joinFrame, heartbeatFrame, jackpotPoolsFrame, getBalanceFrame } from "./frames";
import {
  parseJoinResponsePayload,
  parseJackpotPoolsFromPayload,
  parseGetBalancePayload,
  readTopLevelBalance,
  mergeJackpotPools,
  emptyJackpotPoolsByTier,
  type JackpotPool,
  type JackpotPoolsByTier,
  type JackpotTierInfo,
  type JackpotPoolsPayload,
  type GameSymbol,
  type LastRound,
} from "./protocol";
import { isTokenBannedStompError } from "./stomp-errors";
import type { GamePhase } from "./game-phase";

const POST_AUTH_BEFORE_JOIN_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;

type WsSessionCallbacks = {
  onTokenBan: () => void;
  onConnectionLost: (message: string) => void;
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

export function useWsSession(
  wsUrl: string,
  gameId: string,
  agentId: string,
  jackpotTierInfo: readonly JackpotTierInfo[],
  wsAccessToken: string,
  callbacks: WsSessionCallbacks,
) {
  const timeoutMs = useMemo(() => readEnvDefaults().timeoutMs, []);
  const clientRef = useRef<BrowserWsClient | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const heartbeatCounterRef = useRef(1);
  const sessionRefreshTimerRef = useRef<number | null>(null);
  const sessionRefreshInFlightRef = useRef(false);
  const stompListenerCleanupRef = useRef<(() => void) | null>(null);
  const disconnectListenerCleanupRef = useRef<(() => void) | null>(null);
  const sessionReadyRef = useRef(false);
  const sessionEndingRef = useRef(false);
  const joinInFlightRef = useRef(false);
  const gameRouteRef = useRef(gameId.trim());

  const [phase, setPhaseState] = useState<GamePhase>("disconnected");
  const setPhase = useCallback((next: GamePhase) => setPhaseState(next), []);
  const [gameScreenActive, setGameScreenActive] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [symbolCatalog, setSymbolCatalog] = useState<GameSymbol[]>([]);
  const [betLevels, setBetLevels] = useState<string[]>([]);
  const [lastRound, setLastRound] = useState<LastRound | null>(null);
  const [jackpotPoolsByTier, setJackpotPoolsByTier] = useState<JackpotPoolsByTier>(() =>
    emptyJackpotPoolsByTier(jackpotTierInfo),
  );
  const [jackpotPoolsLoading, setJackpotPoolsLoading] = useState(false);
  const [jackpotWinnersRefreshToken, setJackpotWinnersRefreshToken] = useState(0);
  const [joinRetryOpen, setJoinRetryOpen] = useState(false);
  const [joinRetryMessage, setJoinRetryMessage] = useState<string | null>(null);

  useEffect(() => { sessionReadyRef.current = sessionReady; }, [sessionReady]);

  // --- helpers (same as current useGameSession) ---
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const stopSessionRefresh = useCallback(() => {
    if (sessionRefreshTimerRef.current !== null) {
      window.clearInterval(sessionRefreshTimerRef.current);
      sessionRefreshTimerRef.current = null;
    }
    sessionRefreshInFlightRef.current = false;
  }, []);

  const detachStompListener = useCallback(() => {
    stompListenerCleanupRef.current?.();
    stompListenerCleanupRef.current = null;
  }, []);

  const detachDisconnectListener = useCallback(() => {
    disconnectListenerCleanupRef.current?.();
    disconnectListenerCleanupRef.current = null;
  }, []);

  const applyJackpotPools = useCallback((pools: JackpotPool[]) => {
    if (pools.length === 0) return;
    setJackpotPoolsByTier((prev) => mergeJackpotPools(prev, pools));
  }, []);

  const applyJackpotPoolsFromPayload = useCallback((payload: Record<string, unknown>) => {
    const pools = parseJackpotPoolsFromPayload(payload);
    if (pools) applyJackpotPools(pools);
  }, [applyJackpotPools]);

  const refreshBalance = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.isConnected() || !sessionReadyRef.current) return;
    try {
      const payloadPromise = client.waitForPayload(isGetBalanceResponsePayload, "balance query", { rejectMatcher: isGetBalanceErrorPayload });
      client.sendFrame(getBalanceFrame(gameRouteRef.current));
      const payload = await payloadPromise;
      const parsed = parseGetBalancePayload(payload);
      if (parsed) setBalance(parsed.balance);
    } catch { /* silent */ }
  }, []);

  const fetchJackpotPools = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.isConnected()) return;
    setJackpotPoolsLoading(true);
    try {
      const payloadPromise = client.waitForPayload(isJackpotPoolsPayload, "jackpot pools");
      client.sendFrame(jackpotPoolsFrame(gameRouteRef.current));
      const payload = await payloadPromise;
      applyJackpotPools((payload as unknown as JackpotPoolsPayload).pools);
    } catch { /* best-effort */ }
    finally { setJackpotPoolsLoading(false); }
  }, [applyJackpotPools]);

  const reauthWsWithToken = useCallback((client: BrowserWsClient, token: string) => {
    client.sendFrame(connectFrame(agentId.trim(), token.trim(), true));
  }, [agentId]);

  const performWsSessionRefresh = useCallback(async (client: BrowserWsClient) => {
    if (sessionRefreshInFlightRef.current) return;
    sessionRefreshInFlightRef.current = true;
    try {
      if (clientRef.current !== client) return;
      if (!client.isConnected()) { callbacks.onConnectionLost("Connection lost (refresh: socket not open)"); return; }
      const stored = loadRefreshToken();
      if (!stored) { callbacks.onConnectionLost("Session refresh token missing"); return; }
      const { accessToken, refreshToken: nextRt } = await refreshSessionToken(stored);
      saveRefreshToken(nextRt);
      reauthWsWithToken(client, accessToken);
      if (sessionReadyRef.current) void refreshBalance();
    } catch (e) {
      callbacks.onConnectionLost(`Session refresh failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { sessionRefreshInFlightRef.current = false; }
  }, [callbacks, reauthWsWithToken, refreshBalance]);

  const startSessionRefresh = useCallback((client: BrowserWsClient) => {
    stopSessionRefresh();
    sessionRefreshTimerRef.current = window.setInterval(() => {
      void performWsSessionRefresh(client);
    }, getWsSessionRefreshIntervalMs());
  }, [performWsSessionRefresh, stopSessionRefresh]);

  const startHeartbeat = useCallback((client: BrowserWsClient) => {
    stopHeartbeat();
    heartbeatCounterRef.current = 1;
    heartbeatTimerRef.current = window.setInterval(() => {
      if (clientRef.current !== client) { stopHeartbeat(); return; }
      if (!client.isConnected()) { stopHeartbeat(); callbacks.onConnectionLost("Connection lost (heartbeat: socket not open)"); return; }
      try {
        client.sendFrame(heartbeatFrame(heartbeatCounterRef.current));
        heartbeatCounterRef.current += 1;
      } catch (e) {
        stopHeartbeat();
        callbacks.onConnectionLost(`Connection lost (heartbeat failed: ${e instanceof Error ? e.message : String(e)})`);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [callbacks, stopHeartbeat]);

  const endSession = useCallback((opts?: { error?: string | null }) => {
    if (sessionEndingRef.current) return;
    sessionEndingRef.current = true;
    detachDisconnectListener();
    detachStompListener();
    stopHeartbeat();
    stopSessionRefresh();
    clientRef.current?.close();
    clientRef.current = null;
    setError(opts?.error === undefined ? null : opts.error);
    setGameScreenActive(false);
    setSessionReady(false);
    setLastRound(null);
    setJackpotPoolsByTier(emptyJackpotPoolsByTier(jackpotTierInfo));
    setJackpotPoolsLoading(false);
    setJackpotWinnersRefreshToken(0);
    setBetLevels([]);
    setSymbolCatalog([]);
    setBalance(null);
    joinInFlightRef.current = false;
    setJoinRetryOpen(false);
    setJoinRetryMessage(null);
    setPhase("disconnected");
    sessionEndingRef.current = false;
  }, [detachDisconnectListener, detachStompListener, stopHeartbeat, stopSessionRefresh, jackpotTierInfo, setPhase]);

  const disconnect = useCallback(() => endSession({ error: null }), [endSession]);

  const handleJoinFailure = useCallback((message: string) => {
    setPhase("connected");
    setJoinRetryMessage(message);
    setJoinRetryOpen(true);
  }, [setPhase]);

  // --- connect & join ---
  const connectToGame = useCallback(async (token: string) => {
    const gameToken = token.trim();
    setError(null);
    setLastRound(null);
    setBalance(null);
    const url = wsUrl.trim();
    const aid = agentId.trim();
    if (!url) { setError("WebSocket URL is required"); return; }
    if (!gameToken) { setError("Access token is required"); return; }
    sessionEndingRef.current = false;
    disconnect();
    setPhase("connecting");

    const client = new BrowserWsClient(url, { timeoutMs });
    clientRef.current = client;
    try {
      await client.connect();
      if (clientRef.current !== client) return;

      detachStompListener();
      detachDisconnectListener();
      stompListenerCleanupRef.current = client.addStompErrorListener((code) => {
        if (isTokenBannedStompError(code)) callbacks.onTokenBan();
      });
      disconnectListenerCleanupRef.current = client.addDisconnectListener((info) => {
        callbacks.onConnectionLost(`Connection lost (code=${info.code}, reason=${info.reason})`);
      });

      client.sendFrame(connectFrame(aid, gameToken, false));
      await delay(500);
      if (!client.isConnected()) throw new Error("Connection rejected by server");

      setPhase("connected");
      startHeartbeat(client);
      startSessionRefresh(client);
      setGameScreenActive(true);
    } catch (e) {
      if (clientRef.current !== client) return;
      if (e instanceof StompTokenBannedError) { callbacks.onTokenBan(); return; }
      callbacks.onConnectionLost(e instanceof Error ? e.message : String(e));
    }
  }, [wsUrl, agentId, timeoutMs, detachDisconnectListener, detachStompListener, disconnect, callbacks, startHeartbeat, startSessionRefresh, setPhase]);

  const joinGame = useCallback(async () => {
    if (sessionReady || joinInFlightRef.current) return;
    const client = clientRef.current;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (client?.isConnected()) break;
      if (attempt < 4) await delay(200);
    }
    if (!client?.isConnected()) { setError("WebSocket is not connected"); return; }
    joinInFlightRef.current = true;
    setError(null);
    setPhase("joining");
    try {
      await delay(POST_AUTH_BEFORE_JOIN_MS);
      if (!client.isConnected()) {
        const ci = client.getLastCloseInfo();
        throw new Error(`Disconnected before join (${ci ? `code=${ci.code} reason=${ci.reason}` : "socket not open"})`);
      }
      const payloadPromise = client.waitForPayload(isJoinResponsePayload, "join response");
      client.sendFrame(joinFrame(gameRouteRef.current));
      const raw = await payloadPromise;
      const parsed = parseJoinResponsePayload(raw);
      if (clientRef.current !== client) return;
      if (!client.isConnected()) {
        const ci = client.getLastCloseInfo();
        throw new Error(`Disconnected after join (${ci ? `code=${ci.code} reason=${ci.reason}` : "socket not open"})`);
      }
      setSymbolCatalog(parsed.symbols);
      const jb = parsed.balance ?? readTopLevelBalance(raw);
      if (jb) setBalance(jb);
      if (parsed.lastRound) setLastRound(parsed.lastRound);
      // bet levels — game-specific hook should apply them
      const levels = Array.isArray(parsed.betLevels)
        ? parsed.betLevels.filter((l): l is string => typeof l === "string")
        : [];
      setBetLevels(levels);
      applyJackpotPoolsFromPayload(raw);
      setJoinRetryOpen(false);
      setJoinRetryMessage(null);
      setSessionReady(true);
      setPhase("joined");
      void fetchJackpotPools();
    } catch (e) {
      if (e instanceof StompTokenBannedError) { callbacks.onTokenBan(); return; }
      const msg = e instanceof Error ? e.message : String(e);
      if (!clientRef.current?.isConnected()) { callbacks.onConnectionLost(msg); return; }
      handleJoinFailure(msg);
    } finally { joinInFlightRef.current = false; }
  }, [sessionReady, applyJackpotPoolsFromPayload, fetchJackpotPools, callbacks, handleJoinFailure, setPhase]);

  const dismissJoinRetry = useCallback(() => {
    setJoinRetryOpen(false);
    setJoinRetryMessage(null);
    callbacks.onTokenBan(); // clears session → back to login
  }, [callbacks]);

  // --- auto-connect on mount ---
  useEffect(() => {
    if (!wsAccessToken.trim()) return;
    queueMicrotask(() => { void connectToGame(wsAccessToken); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- jackpot push listeners ---
  useEffect(() => {
    const client = clientRef.current;
    if (!sessionReady || !client?.isConnected()) return;
    const r1 = client.addPayloadListener(isJackpotPoolsPushPayload, (p) => applyJackpotPoolsFromPayload(p));
    const r2 = client.addPayloadListener(isJackpotWinnerPush, () => setJackpotWinnersRefreshToken((t) => t + 1));
    return () => { r1(); r2(); };
  }, [applyJackpotPoolsFromPayload, sessionReady]);

  // --- visibility change → refresh balance ---
  useEffect(() => {
    const h = () => { if (document.visibilityState === "visible") void refreshBalance(); };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [refreshBalance]);

  // --- cleanup on unmount ---
  useEffect(() => () => { stopHeartbeat(); stopSessionRefresh(); }, [stopHeartbeat, stopSessionRefresh]);

  return {
    phase, sessionReady, gameScreenActive, error,
    balance, setBalance,
    symbolCatalog, betLevels, lastRound,
    jackpotPoolsByTier, jackpotPoolsLoading, jackpotWinnersRefreshToken,
    gameRoute: gameRouteRef.current,
    clientRef,
    joinGame,
    joinRetryOpen, joinRetryMessage,
    joinRetryBusy: phase === "joining",
    dismissJoinRetry,
    disconnect,
    refreshBalance,
    fetchJackpotPools,
    applyJackpotPools,
    applyJackpotPoolsFromPayload,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit 2>&1 | head -20
```

Expected: No errors in `useWsSession.ts`.

---

### Task 3: Update `src/games.ts` — add GameScreen component reference

**Files:**
- Modify: `src/games.ts`

- [ ] **Step 1: Add `GameScreen` component type to `GameDef`**

```ts
// src/games.ts — add to existing file
import type { ComponentType } from "react";

export type GameScreenProps = {
  agencyUserToken: string;
  wsAccessToken: string;
  onBackToLobby: () => void;
  onLogout: () => void;
};

// Add to GameDef interface:
export interface GameDef {
  id: string;
  name: string;
  icon: string;
  agentId: string;
  jackpotTiers: JackpotTierDef[];
  winSystem: "winways" | "paylines";
  GameScreen: ComponentType<GameScreenProps>;  // ★ new field
}

// The GAMES array gets GameScreen: null for now, filled in later tasks
import { AngkorGameScreen } from "./games/game-the-last-guardian-of-angkor";

const GAMES: GameDef[] = [
  {
    id: "game-the-last-guardian-of-angkor",
    name: "The Last Guardian of Angkor",
    icon: "🏛️",
    agentId: "AGENCY_001",
    winSystem: "winways",
    jackpotTiers: [
      { key: "NANO", label: "NANO", isStatic: true, betMultiplier: 20 },
      { key: "CYBER", label: "CYBER", isStatic: true, betMultiplier: 50 },
      { key: "GUARDIAN", label: "GUARDIAN", isStatic: false },
      { key: "ETERNAL", label: "ETERNAL", isStatic: false },
    ],
    GameScreen: AngkorGameScreen,
  },
  // Titan added in later task
];
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc -b --noEmit 2>&1 | head -20
```

Expected: Error about missing `AngkorGameScreen` import — that's fine, created in next task.

---

### Task 4: Create Angkor game module — directory and lib files

**Files:**
- Create: `src/games/game-the-last-guardian-of-angkor/lib/reel-spin.ts`
- Create: `src/games/game-the-last-guardian-of-angkor/lib/cheat.ts`
- Create: `src/games/game-the-last-guardian-of-angkor/lib/celebrations.ts`
- Create: `src/games/game-the-last-guardian-of-angkor/lib/celebration-timing.ts`
- Create: `src/games/game-the-last-guardian-of-angkor/lib/round-flow.ts`
- Create: `src/games/game-the-last-guardian-of-angkor/lib/wait-for-spin-ui.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/games/game-the-last-guardian-of-angkor/lib
mkdir -p src/games/game-the-last-guardian-of-angkor/components
```

- [ ] **Step 2: Move Angkor lib files**

Move files from `src/lib/` → `src/games/game-the-last-guardian-of-angkor/lib/`, updating imports:

```bash
# Move each file
git mv src/lib/reel-spin.ts src/games/game-the-last-guardian-of-angkor/lib/reel-spin.ts
git mv src/lib/cheat.ts src/games/game-the-last-guardian-of-angkor/lib/cheat.ts
git mv src/lib/spin-celebrations.ts src/games/game-the-last-guardian-of-angkor/lib/celebrations.ts
git mv src/lib/celebration-timing.ts src/games/game-the-last-guardian-of-angkor/lib/celebration-timing.ts
git mv src/lib/round-flow.ts src/games/game-the-last-guardian-of-angkor/lib/round-flow.ts
git mv src/lib/wait-for-spin-ui.ts src/games/game-the-last-guardian-of-angkor/lib/wait-for-spin-ui.ts
```

- [ ] **Step 3: Update imports in moved files**

Each moved file's imports that reference `../ws/` or `../api/` need paths adjusted:

- `reel-spin.ts`: No external imports (self-contained), no changes needed
- `cheat.ts`: No external imports (self-contained), no changes needed
- `celebrations.ts`: Import from `../../lib/session-utils` → `../../../lib/session-utils` and `../../ws/protocol` → `../../../ws/protocol`
- `celebration-timing.ts`: Self-contained, no changes
- `round-flow.ts`: Import from `../../ws/protocol` → `../../../ws/protocol`
- `wait-for-spin-ui.ts`: Import from `./celebration-timing` → `./celebration-timing`, `./spin-celebrations` → `./celebrations`, `../../ws/protocol` → `../../../ws/protocol`

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc -b --noEmit 2>&1 | head -30
```

Expected: Errors only from files not yet created/moved (components, GameScreen, etc.).

---

### Task 5: Move Angkor components to game module

**Files:**
- Move: 15 components from `src/components/` → `src/games/game-the-last-guardian-of-angkor/components/`

- [ ] **Step 1: Move all Angkor components**

```bash
for f in SlotCabinet WinWayReelGrid SlotReelColumn SlotStageBlock SlotControls SlotConsoleBalance SlotCelebrationOverlay BetPickerModal CheatModal CheatReelGridEditor HistoryModal HistoryView JackpotPoolsBar JackpotWinnersModal JackpotWinnersView JoinRetryModal; do
  git mv "src/components/${f}.tsx" "src/games/game-the-last-guardian-of-angkor/components/${f}.tsx"
done
```

- [ ] **Step 2: Update imports in each moved component**

Each component's imports from `../lib/`, `../hooks/`, `../ws/` need path adjustments. Update imports to:

| Old import path | New import path |
|---|---|
| `../lib/reel-spin` | `../lib/reel-spin` (same dir level) |
| `../lib/cheat` | `../lib/cheat` |
| `../lib/session-utils` | `../../../lib/session-utils` |
| `../lib/format-bet` | `../../../lib/format-bet` |
| `../lib/celebration-timing` | `../lib/celebration-timing` |
| `../lib/spin-celebrations` | `../lib/celebrations` |
| `../lib/round-flow` | `../lib/round-flow` |
| `../lib/wait-for-spin-ui` | `../lib/wait-for-spin-ui` |
| `../hooks/useAutoSpin` | `../../../hooks/useAutoSpin` (move later) |
| `../hooks/useRoundRunner` | `../../../hooks/useRoundRunner` (move later) |
| `../hooks/useSyncRef` | `../../../hooks/useSyncRef` |
| `../hooks/useReelStripMotion` | `../../../hooks/useReelStripMotion` (move later) |
| `../hooks/useGameSession` | `../useGameSession` (created in next task) |
| `../ws/protocol` | `../../../ws/protocol` |
| `../ws/frames` | `../../../ws/frames` |
| `../ws/browser-ws-client` | `../../../ws/browser-ws-client` |
| `../config` | `../../../config` |

Do this with find-and-replace in each moved file:

```bash
cd src/games/game-the-last-guardian-of-angkor/components
# Fix imports for ws/, lib/, hooks/ that moved
for f in *.tsx; do
  sed -i '' 's|from "../ws/|from "../../../ws/|g' "$f"
  sed -i '' 's|from "../lib/reel-spin"|from "../lib/reel-spin"|g' "$f"
  sed -i '' 's|from "../lib/cheat"|from "../lib/cheat"|g' "$f"
  sed -i '' 's|from "../lib/session-utils"|from "../../../lib/session-utils"|g' "$f"
  sed -i '' 's|from "../lib/format-bet"|from "../../../lib/format-bet"|g' "$f"
  sed -i '' 's|from "../lib/celebration-timing"|from "../lib/celebration-timing"|g' "$f"
  sed -i '' 's|from "../lib/spin-celebrations"|from "../lib/celebrations"|g' "$f"
  sed -i '' 's|from "../lib/round-flow"|from "../lib/round-flow"|g' "$f"
  sed -i '' 's|from "../lib/wait-for-spin-ui"|from "../lib/wait-for-spin-ui"|g' "$f"
  sed -i '' 's|from "../hooks/useSyncRef"|from "../../../hooks/useSyncRef"|g' "$f"
  sed -i '' 's|from "../hooks/useAutoSpin"|from "../../../hooks/useAutoSpin"|g' "$f"
  sed -i '' 's|from "../hooks/useRoundRunner"|from "../../../hooks/useRoundRunner"|g' "$f"
  sed -i '' 's|from "../hooks/useReelStripMotion"|from "../../../hooks/useReelStripMotion"|g' "$f"
  sed -i '' 's|from "../hooks/useGameSession"|from "../useGameSession"|g' "$f"
  sed -i '' 's|from "../config"|from "../../../config"|g' "$f"
done
```

- [ ] **Step 3: Move Angkor-specific hooks**

```bash
git mv src/hooks/useAutoSpin.ts src/games/game-the-last-guardian-of-angkor/hooks/useAutoSpin.ts
git mv src/hooks/useRoundRunner.ts src/games/game-the-last-guardian-of-angkor/hooks/useRoundRunner.ts
git mv src/hooks/useReelStripMotion.ts src/games/game-the-last-guardian-of-angkor/hooks/useReelStripMotion.ts
```

Update their internal imports to match new paths.

- [ ] **Step 4: Move Angkor CSS**

```bash
git mv src/slot-cabinet.css src/games/game-the-last-guardian-of-angkor/slot-cabinet.css
```

Update `GameScreen.tsx` (next task) to import from `./slot-cabinet.css`.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc -b --noEmit 2>&1 | wc -l
```

Expected: Many errors from broken imports — will resolve in next tasks.

---

### Task 6: Create Angkor `useGameSession` wrapping `useWsSession`

**Files:**
- Create: `src/games/game-the-last-guardian-of-angkor/useGameSession.ts`

**Interfaces:**
- Consumes: `useWsSession` from `../../ws/useWsSession`
- Produces: Game-specific hook with spin, cheat, history, celebrations — everything the old `useGameSession` provided to GameScreen

- [ ] **Step 1: Create Angkor `useGameSession.ts`**

This is the existing `src/hooks/useGameSession.ts` trimmed down: remove WS lifecycle (now in `useWsSession`), remove auth operations (now in `useAuth`), keep game-specific logic (spin, cheat, force jackpot, history, bet management, celebrations).

```ts
// src/games/game-the-last-guardian-of-angkor/useGameSession.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWsSession } from "../../ws/useWsSession";
import {
  CHEAT_SYMBOL_OPTIONS,
  isAllowedCheatSymbolInput,
  cheatGridFromSpinReels,
  cheatGridsEqual,
  cloneCheatGrid,
  emptyCheatGrid,
  setCheatCellValue,
  validateCheatReels,
} from "./lib/cheat";
import {
  buildGoldenWildHighlightSet,
  parseBetLevelsFromJoin,
  readRoundBetString,
  readRoundFeatureBadges,
  readSpinJackpot,
  readSpinRetrigger,
  resolveBetFromLevels,
} from "../../lib/session-utils";
import {
  isSpinResponsePayload,
  isSpinErrorPayload,
  isHistoryListPayload,
  isHistoryDetailPayload,
  isJackpotWinHistoryPayload,
  isForceJackpotResponse,
} from "../../ws/browser-ws-client";
import {
  spinFrame, cheatFrame, forceJackpotNextSpinFrame,
  historyListFrame, HISTORY_LIST_DEFAULT_SIZE,
  historyDetailFrame, jackpotWinHistoryFrame,
} from "../../ws/frames";
import {
  parseHistoryListPayload,
  parseHistoryDetailPayload,
  parseJackpotPoolsFromPayload,
  readTopLevelBalance,
  type JackpotTier,
  type SpinResponsePayload,
  type HistoryListPayload,
  type HistoryDetailPayload,
  type JackpotWinHistoryPayload,
  type LastRound,
} from "../../ws/protocol";
import type { GamePhase } from "../../ws/game-phase";

export function useGameSession(
  wsUrl: string,
  gameId: string,
  agentId: string,
  jackpotTierInfo: Parameters<typeof useWsSession>[3],
  wsAccessToken: string,
  callbacks: Parameters<typeof useWsSession>[5],
) {
  const ws = useWsSession(wsUrl, gameId, agentId, jackpotTierInfo, wsAccessToken, callbacks);

  // --- game-specific state ---
  const [bet, setBet] = useState("1");
  const [lastSpin, setLastSpin] = useState<SpinResponsePayload | null>(null);
  const [spinFreeze, setSpinFreeze] = useState<SpinResponsePayload | LastRound | null>(null);
  const [cheatGrid, setCheatGrid] = useState<string[][]>(() => emptyCheatGrid());
  const [cheatArmed, setCheatArmed] = useState(false);
  const [forceJackpotArmed, setForceJackpotArmed] = useState(false);
  const [forceJackpotBusy, setForceJackpotBusy] = useState(false);
  const [cheatGridDirty, setCheatGridDirty] = useState(false);
  const [cheatInputRejectTick, setCheatInputRejectTick] = useState(0);
  const cheatBaselineRef = useRef<string[][]>(emptyCheatGrid());
  const spinBusyRef = useRef(false);

  // --- apply cheat grid from spin reels ---
  const applyCheatGridFromReels = useCallback((reels: string[][]) => {
    const grid = cheatGridFromSpinReels(reels);
    setCheatGrid(grid);
    cheatBaselineRef.current = cloneCheatGrid(grid);
    setCheatGridDirty(false);
  }, []);

  // Apply last round reels from ws join
  useEffect(() => {
    if (ws.lastRound?.spin?.reels) {
      applyCheatGridFromReels(ws.lastRound.spin.reels);
    }
  }, [ws.lastRound, applyCheatGridFromReels]);

  // Resolve bet from join bet levels
  useEffect(() => {
    const levels = parseBetLevelsFromJoin({ betLevels: ws.betLevels } as any);
    if (levels.length > 0) {
      setBet(resolveBetFromLevels(levels, bet));
    }
  }, [ws.betLevels]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- spin ---
  const isSpinning = ws.phase === "spinning";
  const displaySpin = lastSpin ?? ws.lastRound;

  const viewSpin = useMemo(() => {
    if (isSpinning && spinFreeze !== null) return spinFreeze;
    return displaySpin;
  }, [isSpinning, spinFreeze, displaySpin]);

  const betLocked = useMemo(() => {
    return Boolean(displaySpin?.round && displaySpin.round.isFinished === false);
  }, [displaySpin]);

  const lockedRoundBet = useMemo(() => {
    if (!betLocked || !displaySpin?.round) return null;
    return readRoundBetString(displaySpin.round as { bet: unknown });
  }, [betLocked, displaySpin]);

  const activeBet = useMemo(() => {
    if (lockedRoundBet) return resolveBetFromLevels(ws.betLevels, lockedRoundBet);
    return bet;
  }, [lockedRoundBet, ws.betLevels, bet]);

  const spin = useCallback(async (): Promise<SpinResponsePayload | null> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady || spinBusyRef.current) return null;
    spinBusyRef.current = true;
    setSpinFreeze(lastSpin ?? ws.lastRound);
    // ws.setPhase is internal, we indicate spinning via phase tracking
    try {
      const payloadPromise = client.waitForPayload(isSpinResponsePayload, "spin response", { rejectMatcher: isSpinErrorPayload });
      client.sendFrame(spinFrame(ws.gameRoute, String(activeBet)));
      const payload = await payloadPromise;
      const spinPayload = payload as unknown as SpinResponsePayload;
      const bal = readTopLevelBalance(payload);
      if (bal) ws.setBalance(bal);
      setLastSpin(spinPayload);
      applyCheatGridFromReels(spinPayload.spin.reels);
      const pools = parseJackpotPoolsFromPayload(payload);
      if (pools) ws.applyJackpotPools(pools);
      else void ws.fetchJackpotPools();
      if (cheatArmed || forceJackpotArmed) { setCheatArmed(false); setForceJackpotArmed(false); }
      spinBusyRef.current = false;
      setSpinFreeze(null);
      return spinPayload;
    } catch (e) {
      spinBusyRef.current = false;
      setSpinFreeze(null);
      throw e;
    }
  }, [lastSpin, ws.lastRound, activeBet, cheatArmed, forceJackpotArmed, ws]);

  // --- cheat ---
  const sendCheat = useCallback(() => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady) return;
    const parsed = validateCheatReels(cheatGrid);
    if (!parsed.reels) { /* set error */ return; }
    client.sendFrame(cheatFrame(ws.gameRoute, parsed.reels));
    setCheatArmed(true);
    cheatBaselineRef.current = cloneCheatGrid(cheatGrid);
    setCheatGridDirty(false);
  }, [cheatGrid, ws]);

  const discardCheatGrid = useCallback(() => {
    setCheatGrid(cloneCheatGrid(cheatBaselineRef.current));
    setCheatGridDirty(false);
  }, []);

  const sendForceJackpot = useCallback(async (tier: JackpotTier): Promise<void> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady) throw new Error("Not connected");
    setForceJackpotBusy(true);
    try {
      const payloadPromise = client.waitForPayload(isForceJackpotResponse, "force jackpot");
      client.sendFrame(forceJackpotNextSpinFrame(ws.gameRoute, tier));
      await payloadPromise;
      setForceJackpotArmed(true);
    } finally { setForceJackpotBusy(false); }
  }, [ws]);

  const updateCheatCell = useCallback((reelIndex: number, rowIndex: number, colLen: number, value: string) => {
    if (!isAllowedCheatSymbolInput(value)) { setCheatInputRejectTick((t) => t + 1); return; }
    setCheatGrid((prev) => {
      const next = setCheatCellValue(prev, reelIndex, rowIndex, colLen, value);
      setCheatGridDirty(!cheatGridsEqual(next, cheatBaselineRef.current));
      return next;
    });
  }, []);

  // --- history ---
  const fetchHistoryList = useCallback(async (page: number): Promise<HistoryListPayload> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected()) throw new Error("Not connected");
    const pp = client.waitForPayload(isHistoryListPayload, "history list");
    client.sendFrame(historyListFrame(ws.gameRoute, page, HISTORY_LIST_DEFAULT_SIZE));
    return parseHistoryListPayload(await pp);
  }, [ws]);

  const fetchHistoryDetail = useCallback(async (roundId: string, spinIndex: number): Promise<HistoryDetailPayload> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected()) throw new Error("Not connected");
    const pp = client.waitForPayload(isHistoryDetailPayload, "history detail");
    client.sendFrame(historyDetailFrame(ws.gameRoute, roundId, spinIndex));
    return parseHistoryDetailPayload(await pp);
  }, [ws]);

  const fetchJackpotWinHistory = useCallback(async (): Promise<JackpotWinHistoryPayload> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected()) throw new Error("Not connected");
    const pp = client.waitForPayload(isJackpotWinHistoryPayload, "jackpot win history");
    client.sendFrame(jackpotWinHistoryFrame(ws.gameRoute, 10));
    return (await pp) as unknown as JackpotWinHistoryPayload;
  }, [ws]);

  // --- derived ---
  const canSpin = ws.phase === "joined" && ws.sessionReady && ws.betLevels.length > 0 && ws.betLevels.includes(activeBet);
  const canCheat = ws.phase === "joined" && ws.sessionReady;
  const winWays = viewSpin?.spin?.winWays ?? [];
  const jackpotInfo = useMemo(() => (viewSpin?.spin ? readSpinJackpot(viewSpin.spin) : null), [viewSpin]);
  const retriggerInfo = useMemo(() => (viewSpin?.spin ? readSpinRetrigger(viewSpin.spin) : null), [viewSpin]);
  const goldenWildHighlightKeys = useMemo(() => buildGoldenWildHighlightSet(jackpotInfo?.goldenWildPositions), [jackpotInfo]);
  const featureBadges = useMemo(() => readRoundFeatureBadges(viewSpin), [viewSpin]);

  const selectBetValue = ws.betLevels.length > 0 && ws.betLevels.includes(activeBet) ? activeBet : (ws.betLevels[0] ?? "");

  return {
    ...ws,
    bet, setBet,
    betLevels: ws.betLevels, selectBetValue,
    lastSpin, isSpinning, displaySpin, viewSpin,
    betLocked, activeBet,
    spin, canSpin, canCheat,
    cheatGrid, cheatGridDirty, cheatInputRejectTick, cheatArmed,
    sendCheat, discardCheatGrid, updateCheatCell,
    forceJackpotArmed, forceJackpotBusy, sendForceJackpot,
    fetchHistoryList, fetchHistoryDetail, fetchJackpotWinHistory,
    winWays, jackpotInfo, retriggerInfo, goldenWildHighlightKeys, featureBadges,
    cheatSymbolOptions: CHEAT_SYMBOL_OPTIONS,
  };
}

export type AngkorGameSession = ReturnType<typeof useGameSession>;
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc -b --noEmit 2>&1 | head -20
```

---

### Task 7: Create Angkor `GameScreen.tsx` and `index.ts`

**Files:**
- Create: `src/games/game-the-last-guardian-of-angkor/GameScreen.tsx`
- Create: `src/games/game-the-last-guardian-of-angkor/index.ts`

- [ ] **Step 1: Create `GameScreen.tsx`**

Move `src/screens/GameScreen.tsx` content, update imports to use local `useGameSession` and local components:

```tsx
// src/games/game-the-last-guardian-of-angkor/GameScreen.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSyncRef } from "../../hooks/useSyncRef";
import { useAutoSpin } from "./hooks/useAutoSpin";
import { useRoundRunner } from "./hooks/useRoundRunner";
import HistoryModal from "./components/HistoryModal";
import JackpotPoolsBar from "./components/JackpotPoolsBar";
import JackpotWinnersModal from "./components/JackpotWinnersModal";
import SlotCabinet from "./components/SlotCabinet";
import SlotCelebrationOverlay from "./components/SlotCelebrationOverlay";
import SlotStageBlock from "./components/SlotStageBlock";
import WinWayReelGrid from "./components/WinWayReelGrid";
import { buildSpinCelebrations } from "./lib/celebrations";
import { useGameSession } from "./useGameSession";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import type { SpinResponsePayload } from "../../ws/protocol";
import "./slot-cabinet.css";

export default function GameScreen({ agencyUserToken, wsAccessToken, onBackToLobby, onLogout }: GameScreenProps) {
  const defaults = useMemo(() => readEnvDefaults(), []);
  // Note: gameId, wsUrl, agentId, jackpotTiers should come from game config
  // For Angkor they're hardcoded until registry refactor completes
  const session = useGameSession(
    defaults.wsUrl,
    "game-the-last-guardian-of-angkor",
    "AGENCY_001",
    [
      { key: "NANO", isStatic: true, betMultiplier: 20 },
      { key: "CYBER", isStatic: true, betMultiplier: 50 },
      { key: "GUARDIAN", isStatic: false },
      { key: "ETERNAL", isStatic: false },
    ],
    wsAccessToken,
    { onTokenBan: onLogout, onConnectionLost: onLogout },
  );

  // ... rest of GameScreen implementation (same as current src/screens/GameScreen.tsx)
  // but using session.* from the new useGameSession
}
```

Full implementation is the existing `src/screens/GameScreen.tsx` with updated import paths.

- [ ] **Step 2: Create `index.ts`**

```ts
// src/games/game-the-last-guardian-of-angkor/index.ts
export { default as GameScreen } from "./GameScreen";
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc -b --noEmit 2>&1 | wc -l
```

---

### Task 8: Update `App.tsx` to use new architecture

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/screens/GameScreen.tsx` (moved to Angkor module)
- Delete: `src/hooks/useGameSession.ts` (split into useAuth + useWsSession + Angkor useGameSession)

- [ ] **Step 1: Rewrite `App.tsx`**

```tsx
// src/App.tsx
import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { getGames, type GameDef, type GameScreenProps } from "./games";
import LobbyScreen from "./screens/LobbyScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import JoinRetryModal from "./games/game-the-last-guardian-of-angkor/components/JoinRetryModal";
import "./App.css";

type AppView = "login" | "register" | "lobby" | "game";

export default function App() {
  const auth = useAuth();
  const [view, setView] = useState<AppView>(() => {
    if (auth.agencyUserToken) return "lobby";
    return "login";
  });
  const [selectedGame, setSelectedGame] = useState<GameDef | null>(null);
  const [wsAccessToken, setWsAccessToken] = useState("");

  // Auto-resume from refresh token on page load
  useEffect(() => {
    if (view !== "login" && view !== "register") return;
    auth.refreshAndGetToken().then((result) => {
      if (result) {
        const game = getGames().find((g) => g.id === result.gameId);
        if (game) {
          setSelectedGame(game);
          setWsAccessToken(result.accessToken);
          setView("game");
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoginSuccess = () => setView("lobby");
  const handleRegisterSuccess = () => setView("login");

  const handleLaunchGame = async (game: GameDef) => {
    const result = await auth.playGame(game.id);
    if (result) {
      setSelectedGame(game);
      setWsAccessToken(result.token);
      setView("game");
    }
  };

  const handleBackToLobby = () => {
    setWsAccessToken("");
    setSelectedGame(null);
    setView("lobby");
  };

  const handleLogout = () => {
    auth.logout();
    setWsAccessToken("");
    setSelectedGame(null);
    setView("login");
  };

  const GameScreenComponent = selectedGame?.GameScreen;

  return (
    <div className="game-app">
      {view === "game" && GameScreenComponent && wsAccessToken ? (
        <GameScreenComponent
          agencyUserToken={auth.agencyUserToken}
          wsAccessToken={wsAccessToken}
          onBackToLobby={handleBackToLobby}
          onLogout={handleLogout}
        />
      ) : view === "lobby" ? (
        <LobbyScreen
          loggedIn={auth.agencyUserToken !== ""}
          error={auth.error}
          busy={auth.busy}
          onLaunch={handleLaunchGame}
          onLogout={handleLogout}
        />
      ) : view === "register" ? (
        <RegisterScreen
          agencyUserToken={auth.agencyUserToken}
          error={auth.error}
          setError={auth.setError}
          authSuccessMessage={auth.authSuccessMessage}
          setAuthSuccessMessage={auth.setAuthSuccessMessage}
          registerAccount={auth.register}
          busyRegister={auth.busy}
          onShowLogin={() => { auth.setError(null); auth.setAuthSuccessMessage(null); setView("login"); }}
          onRegisterSuccess={handleRegisterSuccess}
        />
      ) : (
        <LoginScreen
          agencyUserToken={auth.agencyUserToken}
          error={auth.error}
          setError={auth.setError}
          authSuccessMessage={auth.authSuccessMessage}
          setAuthSuccessMessage={auth.setAuthSuccessMessage}
          login={auth.login}
          onShowRegister={() => { auth.setError(null); auth.setAuthSuccessMessage(null); setView("register"); }}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
```

Note: LoginScreen and RegisterScreen props change slightly — they no longer receive `{...session}`. Update their props interfaces in a follow-up pass.

- [ ] **Step 2: Update LoginScreen and RegisterScreen prop types**

Change LoginScreen/RegisterScreen to accept explicit props instead of spreading the old session object. The props are: `error`, `setError`, `authSuccessMessage`, `setAuthSuccessMessage`, `agencyUserToken`, `login`, `registerAccount`, `busyRegister`.

- [ ] **Step 3: Remove old files**

```bash
rm src/screens/GameScreen.tsx  # moved to Angkor module
rm src/hooks/useGameSession.ts # split into useAuth + useWsSession + game hooks
```

- [ ] **Step 4: Verify app builds and runs**

```bash
npm run build 2>&1 | tail -10
npm run dev
# → Open browser, verify login → lobby → launch Angkor → spin works
```

---

### Task 9: Create Titan's Wrath game module — lib files

**Files:**
- Create: `src/games/yama_01021/lib/paylines.ts`
- Create: `src/games/yama_01021/lib/reel-spin.ts`
- Create: `src/games/yama_01021/lib/celebrations.ts`
- Create: `src/games/yama_01021/lib/celebration-timing.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/games/yama_01021/lib
mkdir -p src/games/yama_01021/components
```

- [ ] **Step 2: Create `lib/paylines.ts` — 10 payline definitions**

```ts
// src/games/yama_01021/lib/paylines.ts

/** 10 fixed paylines for Titan's Wrath (5×3 grid).
 *  Each payline is an array of 5 row indices (0=top, 1=middle, 2=bottom).
 *  Both-ways: win matches left→right OR right→left starting from reel 0 or 4.
 */
export const PAYLINES: ReadonlyArray<readonly number[]> = [
  [1, 1, 1, 1, 1], // P01: Middle horizontal
  [0, 0, 0, 0, 0], // P02: Top horizontal
  [2, 2, 2, 2, 2], // P03: Bottom horizontal
  [2, 1, 0, 1, 2], // P04: Inverted V
  [0, 1, 2, 1, 0], // P05: V-shape
  [0, 0, 1, 0, 0], // P06: Shallow V
  [2, 0, 1, 0, 0], // P07: Zigzag
  [1, 2, 2, 2, 1], // P08: Bowl / Shallow U
  [1, 0, 0, 0, 1], // P09: Arch / Inverted U
  [1, 0, 1, 0, 1], // P10: Wavy
];

export const PAYLINE_COUNT = PAYLINES.length;

/** Grid dimensions for Titan's Wrath */
export const GRID_REELS = 5;
export const GRID_ROWS = 3;

/** Check if a symbol appears consecutively along a payline (>=3).
 *  Returns the match count or 0. Checks both directions.
 */
export function matchOnPayline(
  reels: string[][],
  payline: readonly number[],
): { symbol: string; count: number; positions: [number, number][] } | null {
  // Check left→right
  if (reels[0]?.[payline[0]] == null) return null;
  const startSymbol = reels[0][payline[0]];
  let ltrCount = 1;
  const ltrPos: [number, number][] = [[0, payline[0]]];
  for (let r = 1; r < GRID_REELS; r++) {
    const row = payline[r];
    if (reels[r]?.[row] === startSymbol || reels[r]?.[row] === "W") {
      ltrCount++;
      ltrPos.push([r, row]);
    } else break;
  }

  // Check right→left
  const endSymbol = reels[4]?.[payline[4]];
  let rtlCount = 1;
  const rtlPos: [number, number][] = [[4, payline[4]]];
  for (let r = 3; r >= 0; r--) {
    const row = payline[r];
    if (reels[r]?.[row] === endSymbol || reels[r]?.[row] === "W") {
      rtlCount++;
      rtlPos.push([r, row]);
    } else break;
  }

  if (ltrCount >= 3 && ltrCount >= rtlCount) {
    return { symbol: startSymbol, count: ltrCount, positions: ltrPos };
  }
  if (rtlCount >= 3) {
    return { symbol: endSymbol!, count: rtlCount, positions: rtlPos.reverse() };
  }
  return null;
}

/** Count all winning paylines and group by effect threshold. */
export function evaluateAllPaylines(reels: string[][]): {
  winningLines: { paylineIndex: number; symbol: string; count: number }[];
  comboLevel: "none" | "combo" | "super" | "mega";
} {
  const winning: { paylineIndex: number; symbol: string; count: number }[] = [];
  for (let i = 0; i < PAYLINES.length; i++) {
    const match = matchOnPayline(reels, PAYLINES[i]);
    if (match && match.count >= 3) {
      winning.push({ paylineIndex: i, symbol: match.symbol, count: match.count });
    }
  }
  const n = winning.length;
  const comboLevel: "none" | "combo" | "super" | "mega" =
    n >= 6 ? "mega" : n >= 4 ? "super" : n >= 2 ? "combo" : "none";
  return { winningLines: winning, comboLevel };
}
```

- [ ] **Step 3: Create `lib/reel-spin.ts` — Titan reel motion**

```ts
// src/games/yama_01021/lib/reel-spin.ts

export const REEL_SPIN = {
  minSpinMs: 600,
  stopIntervalMs: 350,
  stopDurationMs: 700,
  loopSegmentLength: 10,
  tailLength: 3,
  spinRampUpMs: 400,
  spinCruiseSpeedPxPerSec: 700,
  bounceMs: 180,
} as const;

export const SPIN_STRIP_SYMBOLS = [
  "A", "B", "C", "D", "E", "F", "G", "W",
] as const;

export type ReelVisualState = "idle" | "spinning" | "stopping" | "stopped";

export function randomSpinSymbol(): string {
  return SPIN_STRIP_SYMBOLS[Math.floor(Math.random() * SPIN_STRIP_SYMBOLS.length)];
}

export function buildSpinStrip(length: number): string[] {
  return Array.from({ length }, () => randomSpinSymbol());
}

export function createSpinLoopSegment(): string[] {
  return buildSpinStrip(REEL_SPIN.loopSegmentLength);
}

export function placeholderResult(colLen: number): string[] {
  return buildSpinStrip(colLen);
}

export function initialReelStates(count: number): ReelVisualState[] {
  return Array.from({ length: count }, () => "idle");
}

export function spinningReelStates(count: number): ReelVisualState[] {
  return Array.from({ length: count }, () => "spinning");
}

export function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * Math.max(0, Math.min(1, t))) - 1) / 2;
}
```

- [ ] **Step 4: Create `lib/celebrations.ts` — Titan celebration builder**

```ts
// src/games/yama_01021/lib/celebrations.ts
import { readDecimalWire, formatCreditAmount } from "../../../lib/session-utils";
import type { SpinResponsePayload } from "../../../ws/protocol";

export type TitanCelebrationKind =
  | "jackpot"
  | "titan_wrath"
  | "respin"
  | "combo"
  | "super_combo"
  | "mega_combo"
  | "win";

export type TitanCelebrationItem = {
  id: string;
  kind: TitanCelebrationKind;
  title: string;
  detail?: string;
};

const KIND_PRIORITY: Record<TitanCelebrationKind, number> = {
  jackpot: 0,
  titan_wrath: 1,
  mega_combo: 2,
  super_combo: 3,
  combo: 4,
  respin: 5,
  win: 6,
};

export function buildTitanCelebrations(
  payload: SpinResponsePayload | null | undefined,
  comboLevel: "none" | "combo" | "super" | "mega",
): TitanCelebrationItem[] {
  if (!payload?.spin) return [];
  const items: TitanCelebrationItem[] = [];
  const spin = payload.spin;

  // Jackpot
  const jp = spin.jackpot as Record<string, unknown> | undefined;
  if (jp?.triggered) {
    items.push({
      id: "jackpot",
      kind: "jackpot",
      title: "Jackpot!",
      detail: `${jp.tier ?? "—"} · +${formatCreditAmount(String(jp.jackpotWin ?? "0"))}`,
    });
  }

  // Titan's Wrath (5-of-a-kind → triggers contains TITANS_WRATH or similar)
  if (Array.isArray(spin.triggers) && spin.triggers.includes("TITANS_WRATH")) {
    items.push({
      id: "titan_wrath",
      kind: "titan_wrath",
      title: "Titan's Wrath x4!",
      detail: "5-of-a-kind collision",
    });
  }

  // Combo levels
  if (comboLevel === "mega") {
    items.push({ id: "mega_combo", kind: "mega_combo", title: "MEGA COMBO!", detail: "6+ winning lines" });
  } else if (comboLevel === "super") {
    items.push({ id: "super_combo", kind: "super_combo", title: "SUPER COMBO!", detail: "4-5 winning lines" });
  } else if (comboLevel === "combo") {
    items.push({ id: "combo", kind: "combo", title: "COMBO!", detail: "2-3 winning lines" });
  }

  // Respin
  if (Array.isArray(spin.triggers) && spin.triggers.includes("RESPIN")) {
    items.push({ id: "respin", kind: "respin", title: "Respin!", detail: "Expanding Wild" });
  }

  // Win
  const spinWin = readDecimalWire(spin.win as unknown);
  if (Number(spinWin) > 0 && !jp?.triggered) {
    items.push({ id: "win", kind: "win", title: "Winner!", detail: `+${formatCreditAmount(spinWin)}` });
  }

  return items.sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]).slice(0, 3);
}
```

- [ ] **Step 5: Create `lib/celebration-timing.ts`**

```ts
// src/games/yama_01021/lib/celebration-timing.ts
export const CELEBRATION_DISPLAY_MS = 1200;
export const CELEBRATION_EXIT_MS = 300;
export const CELEBRATION_SEQUENCE_MS = CELEBRATION_DISPLAY_MS + CELEBRATION_EXIT_MS;
export const WIN_PRESENTATION_DWELL_MS = 1000;
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc -b --noEmit 2>&1 | grep yama_01021 | head -20
```

---

### Task 10: Create Titan components

**Files:**
- Create: `src/games/yama_01021/components/PaylineReelGrid.tsx`
- Create: `src/games/yama_01021/components/TitanReelColumn.tsx`
- Create: `src/games/yama_01021/components/TitanControls.tsx`
- Create: `src/games/yama_01021/components/SuperBetToggle.tsx`
- Create: `src/games/yama_01021/components/AutoSpinPicker.tsx`
- Create: `src/games/yama_01021/components/TitanCabinet.tsx`
- Create: `src/games/yama_01021/components/TitanCelebrationOverlay.tsx`
- Create: `src/games/yama_01021/components/ComboOverlay.tsx`

- [ ] **Step 1: Create `PaylineReelGrid.tsx`**

5×3 grid with payline win visualization. Shows symbols, highlights winning cells on paylines, handles spinning/stopping reel animation.

```tsx
// src/games/yama_01021/components/PaylineReelGrid.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GRID_REELS, GRID_ROWS, PAYLINES, evaluateAllPaylines } from "../lib/paylines";
import {
  REEL_SPIN, createSpinLoopSegment, initialReelStates,
  placeholderResult, spinningReelStates, type ReelVisualState,
} from "../lib/reel-spin";
import TitanReelColumn from "./TitanReelColumn";

export type PaylineReelGridProps = {
  reels: string[][];
  spinning?: boolean;
  onPresentationChange?: (active: boolean) => void;
};

export default function PaylineReelGrid({
  reels, spinning = false, onPresentationChange,
}: PaylineReelGridProps) {
  const [reelStates, setReelStates] = useState<ReelVisualState[]>(() => initialReelStates(GRID_REELS));
  const [loopSegments, setLoopSegments] = useState<string[][]>([]);
  const [placeholderResults, setPlaceholderResults] = useState<string[][]>([]);
  const [spinOriginReels, setSpinOriginReels] = useState<string[][]>([]);
  const [bouncingReel, setBouncingReel] = useState<number | null>(null);
  const [presentationActive, setPresentationActive] = useState(false);

  const spinStartRef = useRef(0);
  const spinCycleRef = useRef(false);
  const stopScheduledRef = useRef(false);
  const stoppedReelsRef = useRef<Set<number>>(new Set());
  const stopTimersRef = useRef<number[]>([]);
  const bounceTimerRef = useRef<number | null>(null);

  const clearStopTimers = useCallback(() => {
    stopTimersRef.current.forEach((t) => window.clearTimeout(t));
    stopTimersRef.current = [];
  }, []);

  const finishPresentation = useCallback(() => {
    if (!spinCycleRef.current) return;
    clearStopTimers();
    spinCycleRef.current = false;
    stopScheduledRef.current = false;
    stoppedReelsRef.current.clear();
    setPresentationActive(false);
    onPresentationChange?.(false);
  }, [clearStopTimers, onPresentationChange]);

  const beginPresentation = useCallback(() => {
    clearStopTimers();
    spinCycleRef.current = true;
    stopScheduledRef.current = false;
    stoppedReelsRef.current.clear();
    spinStartRef.current = Date.now();
    setPresentationActive(true);
    onPresentationChange?.(true);
    setReelStates(spinningReelStates(GRID_REELS));
    setSpinOriginReels(
      Array.from({ length: GRID_REELS }, (_, ci) => {
        const col = reels[ci] ?? [];
        return Array.from({ length: GRID_ROWS }, (_, ri) => col[ri] ?? "");
      }),
    );
    setLoopSegments(Array.from({ length: GRID_REELS }, () => createSpinLoopSegment()));
    setPlaceholderResults(Array.from({ length: GRID_REELS }, () => placeholderResult(GRID_ROWS)));
    setBouncingReel(null);
  }, [clearStopTimers, onPresentationChange, reels]);

  useEffect(() => {
    if (!spinning) return;
    queueMicrotask(() => beginPresentation());
  }, [spinning, beginPresentation]);

  useEffect(() => {
    if (spinning || !spinCycleRef.current || stopScheduledRef.current) return;
    stopScheduledRef.current = true;
    const elapsed = Date.now() - spinStartRef.current;
    const delayBeforeStop = Math.max(0, REEL_SPIN.minSpinMs - elapsed);
    clearStopTimers();

    const scheduleStop = window.setTimeout(() => {
      Array.from({ length: GRID_REELS }, (_, ci) => {
        const timer = window.setTimeout(() => {
          setReelStates((prev) => {
            if (prev[ci] !== "spinning") return prev;
            const next = [...prev];
            next[ci] = "stopping";
            return next;
          });
        }, ci * REEL_SPIN.stopIntervalMs);
        stopTimersRef.current.push(timer);
      });
    }, delayBeforeStop);
    stopTimersRef.current.push(scheduleStop);

    const fallbackMs = delayBeforeStop + (GRID_REELS - 1) * REEL_SPIN.stopIntervalMs + REEL_SPIN.stopDurationMs + REEL_SPIN.bounceMs + 100;
    const fallback = window.setTimeout(() => {
      if (!spinCycleRef.current) return;
      setReelStates(Array.from({ length: GRID_REELS }, () => "stopped"));
      finishPresentation();
    }, fallbackMs);
    stopTimersRef.current.push(fallback);
    return clearStopTimers;
  }, [spinning, reels, clearStopTimers, finishPresentation]);

  const handleReelStopped = useCallback((ci: number) => {
    if (stoppedReelsRef.current.has(ci)) return;
    stoppedReelsRef.current.add(ci);
    setReelStates((prev) => {
      if (prev[ci] === "stopped") return prev;
      const next = [...prev];
      next[ci] = "stopped";
      return next;
    });
    setBouncingReel(ci);
    if (bounceTimerRef.current != null) window.clearTimeout(bounceTimerRef.current);
    bounceTimerRef.current = window.setTimeout(() => {
      setBouncingReel(null);
      bounceTimerRef.current = null;
    }, REEL_SPIN.bounceMs);
    if (stoppedReelsRef.current.size >= GRID_REELS) finishPresentation();
  }, [finishPresentation]);

  const { winningLines, comboLevel } = useMemo(() => evaluateAllPaylines(reels), [reels]);
  const showWin = !presentationActive && !spinning;

  const reelsBusy = spinning || presentationActive;

  return (
    <div className="titan-reels-layout">
      <div className="titan-reels-main">
        <div className="titan-reels-grid-anchor">
          <div className={`titan-reels titan-reels--${GRID_REELS}x${GRID_ROWS}${reelsBusy ? " titan-reels--busy" : ""}`} aria-label="Slot reels" aria-busy={reelsBusy}>
            {Array.from({ length: GRID_REELS }, (_, ci) => (
              <TitanReelColumn
                key={`reel-${ci}`}
                reelIndex={ci}
                column={reels[ci] ?? []}
                originColumn={spinOriginReels[ci] ?? []}
                loopSegment={loopSegments[ci] ?? []}
                motionResult={placeholderResults[ci] ?? []}
                reelState={reelStates[ci]}
                bouncing={bouncingReel === ci}
                showWinPresentation={showWin}
                winningLines={winningLines}
                paylines={PAYLINES}
                onReelStopped={handleReelStopped}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `TitanControls.tsx`**

Bet ± buttons, spin button, fast spin toggle, auto-spin presets, super bet toggle, balance display (7 digits.00 format).

```tsx
// src/games/yama_01021/components/TitanControls.tsx
import { useState } from "react";
import AutoSpinPicker from "./AutoSpinPicker";
import SuperBetToggle from "./SuperBetToggle";

type TitanControlsProps = {
  betValue: string;
  betLevels: string[];
  onBetChange: (v: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  onSpin: () => void;
  autoSpinCount: number | null;
  onAutoSpinChange: (count: number | null) => void;
  fastSpin: boolean;
  onFastSpinToggle: () => void;
  superBet: boolean;
  onSuperBetToggle: () => void;
  balance: string | null;
  connected: boolean;
};

export default function TitanControls({
  betValue, betLevels, onBetChange, betDisabled, canSpin, spinning, onSpin,
  autoSpinCount, onAutoSpinChange, fastSpin, onFastSpinToggle,
  superBet, onSuperBetToggle, balance, connected,
}: TitanControlsProps) {
  const [autoPickerOpen, setAutoPickerOpen] = useState(false);
  const hasLevels = betLevels.length > 0;
  const betIndex = betLevels.indexOf(betValue);

  const decreaseBet = () => {
    if (betIndex > 0) onBetChange(betLevels[betIndex - 1]);
  };
  const increaseBet = () => {
    if (betIndex < betLevels.length - 1) onBetChange(betLevels[betIndex + 1]);
  };

  return (
    <div className="titan-controls" role="group" aria-label="Game controls">
      {/* Balance */}
      <div className="titan-balance">
        <span className="titan-balance-label">Balance</span>
        <span className="titan-balance-value">
          {!connected || balance == null ? "—" : formatTitanBalance(balance)}
        </span>
      </div>

      {/* Bet ± */}
      <div className="titan-bet-cluster">
        <button onClick={decreaseBet} disabled={betDisabled || betIndex <= 0} aria-label="Decrease bet">◀</button>
        <span className="titan-bet-value">{hasLevels ? `$${betValue}` : "—"}</span>
        <button onClick={increaseBet} disabled={betDisabled || betIndex >= betLevels.length - 1} aria-label="Increase bet">▶</button>
      </div>

      {/* Super Bet */}
      <SuperBetToggle active={superBet} onToggle={onSuperBetToggle} disabled={betDisabled} />

      {/* Fast Spin */}
      <button
        className={`titan-fast-spin${fastSpin ? " titan-fast-spin--on" : ""}`}
        onClick={onFastSpinToggle}
        disabled={spinning}
        title="Fast Spin"
      >
        ⚡
      </button>

      {/* Auto Spin */}
      <button
        className="titan-auto-btn"
        onClick={() => setAutoPickerOpen(true)}
        disabled={spinning || !canSpin}
      >
        {autoSpinCount != null ? `${autoSpinCount}` : "Auto"}
      </button>
      {autoPickerOpen && (
        <AutoSpinPicker
          onSelect={(count) => { onAutoSpinChange(count); setAutoPickerOpen(false); }}
          onCancel={() => setAutoPickerOpen(false)}
        />
      )}

      {/* Spin */}
      <button className="titan-spin-btn" onClick={onSpin} disabled={!canSpin || spinning}>
        {spinning ? "…" : autoSpinCount != null ? `◼ ${autoSpinCount}` : "⟳ Spin"}
      </button>
    </div>
  );
}

function formatTitanBalance(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const [intPart] = value.split(".");
  return intPart.padStart(7, "0") + ".00";
}
```

- [ ] **Step 3: Create remaining components**

`TitanReelColumn.tsx`, `SuperBetToggle.tsx`, `AutoSpinPicker.tsx`, `TitanCabinet.tsx`, `TitanCelebrationOverlay.tsx`, `ComboOverlay.tsx` — implement each as focused, single-responsibility components following the same patterns as the Angkor equivalents.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc -b --noEmit 2>&1 | grep yama_01021 | head -20
```

---

### Task 11: Create Titan `useGameSession.ts`

**Files:**
- Create: `src/games/yama_01021/useGameSession.ts`

- [ ] **Step 1: Create `useGameSession.ts`**

Wraps `useWsSession` with Titan-specific logic: 43 bet levels, Super Bet toggle (adds 50%), fast spin mode, auto-spin presets, token jackpot collection tracking, expanding wild + respin chain logic.

```ts
// src/games/yama_01021/useGameSession.ts
import { useCallback, useMemo, useRef, useState } from "react";
import { useWsSession } from "../../ws/useWsSession";
import { isSpinResponsePayload, isSpinErrorPayload } from "../../ws/browser-ws-client";
import { spinFrame } from "../../ws/frames";
import { readTopLevelBalance, type SpinResponsePayload } from "../../ws/protocol";
import { evaluateAllPaylines } from "./lib/paylines";

// Titan fixed bet levels ($0.10 - $100.00)
const TITAN_BET_LEVELS = [
  "0.10","0.20","0.30","0.40","0.50","0.60","0.70","0.80","1.00",
  "1.20","1.40","1.50","1.60","1.80","2.00","2.50","3.00","3.50",
  "4.00","4.50","5.00","6.00","7.00","8.00","9.00","10.00","12.00",
  "14.00","15.00","16.00","18.00","20.00","25.00","30.00","35.00",
  "40.00","45.00","50.00","60.00","70.00","80.00","90.00","100.00",
];

export function useGameSession(
  wsUrl: string, gameId: string, agentId: string,
  jackpotTierInfo: Parameters<typeof useWsSession>[3],
  wsAccessToken: string,
  callbacks: Parameters<typeof useWsSession>[5],
) {
  const ws = useWsSession(wsUrl, gameId, agentId, jackpotTierInfo, wsAccessToken, callbacks);

  const [bet, setBet] = useState(TITAN_BET_LEVELS[0]);
  const [superBet, setSuperBet] = useState(false);
  const [fastSpin, setFastSpin] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState<number | null>(null);
  const [lastSpin, setLastSpin] = useState<SpinResponsePayload | null>(null);
  const spinBusyRef = useRef(false);

  // Total bet = base bet + 50% if super bet on
  const totalBet = useMemo(() => {
    const base = Number(bet);
    if (!Number.isFinite(base)) return bet;
    return superBet ? (base * 1.5).toFixed(2) : bet;
  }, [bet, superBet]);

  const canSpin = ws.phase === "joined" && ws.sessionReady;

  const spin = useCallback(async (): Promise<SpinResponsePayload | null> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady || spinBusyRef.current) return null;
    spinBusyRef.current = true;
    try {
      const payloadPromise = client.waitForPayload(isSpinResponsePayload, "spin", { rejectMatcher: isSpinErrorPayload });
      client.sendFrame(spinFrame(ws.gameRoute, totalBet));
      const payload = await payloadPromise;
      const sp = payload as unknown as SpinResponsePayload;
      const bal = readTopLevelBalance(payload);
      if (bal) ws.setBalance(bal);
      setLastSpin(sp);
      return sp;
    } finally { spinBusyRef.current = false; }
  }, [totalBet, ws]);

  // Combo evaluation from latest spin
  const comboResult = useMemo(() => {
    if (!lastSpin?.spin?.reels) return { winningLines: [], comboLevel: "none" as const };
    return evaluateAllPaylines(lastSpin.spin.reels);
  }, [lastSpin]);

  return {
    ...ws,
    bet, setBet,
    totalBet,
    betLevels: TITAN_BET_LEVELS,
    superBet, setSuperBet,
    fastSpin, setFastSpin,
    autoSpinCount, setAutoSpinCount,
    lastSpin,
    spin, canSpin,
    comboResult,
  };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc -b --noEmit 2>&1 | grep yama_01021 | head -20
```

---

### Task 12: Create Titan `GameScreen.tsx` and `index.ts`, register in games.ts

**Files:**
- Create: `src/games/yama_01021/GameScreen.tsx`
- Create: `src/games/yama_01021/index.ts`
- Modify: `src/games.ts`

- [ ] **Step 1: Create `GameScreen.tsx`**

Titan full game screen: Greek-themed background, PaylineReelGrid, TitanControls, TitanCabinet, feature overlays.

```tsx
// src/games/yama_01021/GameScreen.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameSession } from "./useGameSession";
import TitanCabinet from "./components/TitanCabinet";
import PaylineReelGrid from "./components/PaylineReelGrid";
import TitanControls from "./components/TitanControls";
import TitanCelebrationOverlay from "./components/TitanCelebrationOverlay";
import ComboOverlay from "./components/ComboOverlay";
import { buildTitanCelebrations } from "./lib/celebrations";
import { readEnvDefaults } from "../../config";
import type { GameScreenProps } from "../../games";
import "./titan.css";

const TITAN_GAME_ID = "yama_01021";
const TITAN_AGENT_ID = "AGENCY_001";
const TITAN_JACKPOT_TIERS = [
  { key: "MINI", isStatic: false },
  { key: "MINOR", isStatic: false },
  { key: "MAJOR", isStatic: false },
  { key: "GRAND", isStatic: false },
];

export default function GameScreen({ agencyUserToken, wsAccessToken, onBackToLobby, onLogout }: GameScreenProps) {
  const defaults = useMemo(() => readEnvDefaults(), []);
  const session = useGameSession(
    defaults.wsUrl, TITAN_GAME_ID, TITAN_AGENT_ID,
    TITAN_JACKPOT_TIERS, wsAccessToken,
    { onTokenBan: onLogout, onConnectionLost: onLogout },
  );

  const [reelsPresenting, setReelsPresenting] = useState(false);
  const spinUiActive = session.phase === "spinning" || reelsPresenting;

  useEffect(() => { void session.joinGame(); }, [session.joinGame]);

  const celebrations = useMemo(() => {
    if (spinUiActive || !session.lastSpin?.spin) return [];
    return buildTitanCelebrations(session.lastSpin, session.comboResult.comboLevel);
  }, [spinUiActive, session.lastSpin, session.comboResult.comboLevel]);

  const celebrationKey = useMemo(() => {
    if (!session.lastSpin?.spin?.reels) return "";
    return [session.lastSpin.round?.roundId ?? "", session.lastSpin.spin.spinType ?? "", session.lastSpin.spin.reels.flat().join(",")].join("|");
  }, [session.lastSpin]);

  const joining = !session.sessionReady && session.phase === "joining";

  return (
    <div className="titan-game-screen">
      <div className="titan-toolbar">
        <button onClick={onBackToLobby}>← Lobby</button>
        <button className="titan-logout-btn" onClick={onLogout}>Log out</button>
      </div>

      {joining ? <p className="titan-joining">Joining Titan's Wrath…</p> : null}

      <TitanCabinet
        error={session.error}
        jackpotPoolsByTier={session.jackpotPoolsByTier}
        jackpotTiers={TITAN_JACKPOT_TIERS}
        reels={
          <PaylineReelGrid
            reels={session.lastSpin?.spin?.reels ?? Array.from({ length: 5 }, () => ["?", "?", "?"])}
            spinning={session.phase === "spinning"}
            onPresentationChange={setReelsPresenting}
          />
        }
        celebrations={
          <TitanCelebrationOverlay items={celebrations} visible={!spinUiActive && celebrations.length > 0} resetKey={celebrationKey} />
        }
        combo={<ComboOverlay level={session.comboResult.comboLevel} visible={!spinUiActive && session.comboResult.comboLevel !== "none"} />}
        controls={
          <TitanControls
            betValue={session.bet}
            betLevels={TITAN_BET_LEVELS}
            onBetChange={session.setBet}
            betDisabled={spinUiActive || !session.sessionReady}
            canSpin={session.canSpin && !spinUiActive}
            spinning={spinUiActive}
            onSpin={() => void session.spin()}
            autoSpinCount={session.autoSpinCount}
            onAutoSpinChange={session.setAutoSpinCount}
            fastSpin={session.fastSpin}
            onFastSpinToggle={() => session.setFastSpin(!session.fastSpin)}
            superBet={session.superBet}
            onSuperBetToggle={() => session.setSuperBet(!session.superBet)}
            balance={session.balance}
            connected={session.sessionReady}
          />
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `index.ts`**

```ts
// src/games/yama_01021/index.ts
export { default as GameScreen } from "./GameScreen";
```

- [ ] **Step 3: Register Titan in `src/games.ts`**

```ts
import { GameScreen as TitanGameScreen } from "./games/yama_01021";

// Add to GAMES array:
{
  id: "yama_01021",
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
}
```

- [ ] **Step 4: Full build verification**

```bash
npm run build 2>&1 | tail -20
```

Expected: Clean build, no errors.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
# → Login → Lobby → Click Angkor → spin, cheat, history work
# → Back to Lobby → Click Titan's Wrath → spin, super bet, combos work
# → Back to Lobby → Click Angkor again (no re-login)
# → Refresh page while in Angkor → auto-resume works
# → Refresh page while in Titan → auto-resume works
```
