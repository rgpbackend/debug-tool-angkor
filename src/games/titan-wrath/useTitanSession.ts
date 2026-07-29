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
  isTitanBalanceUpdate,
  isTitanJackpotTriggered,
  type TitanSpinPayload,
  type TitanJackpotTier,
  type TitanJackpotTriggered,
} from "./titan-protocol";
import { titanSpinFrame } from "./titan-frames";
import {
  parseJackpotPoolsFromPayload,
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

// Server route from backend contract — used as the WS game route.
const TITAN_GAME_ROUTE = "yama_01021";

export function useTitanSession(
  wsUrl: string,
  wsAccessToken: string,
  callbacks: WsSessionCallbacks,
  initialBalance?: string | null,
) {
  const wrappedCallbacks: WsSessionCallbacks = {
    onTokenBan: () => { console.error("[TITAN] onTokenBan → logout"); callbacks.onTokenBan(); },
    onConnectionLost: (msg: string) => { console.error("[TITAN] onConnectionLost:", msg); callbacks.onConnectionLost(msg); },
  };
  const ws = useWsSession(
    wsUrl,
    TITAN_GAME_ROUTE,
    "AGENCY_001",
    TITAN_JACKPOT_TIERS,
    wsAccessToken,
    wrappedCallbacks,
    parseTitanMessage,
  );

  // --- titan-specific state ---
  const [bet, setBet] = useState<string>("0.10");
  const [lastSpin, setLastSpin] = useState<TitanSpinPayload | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [superBetActive, setSuperBetActive] = useState(false);
  const spinBusyRef = useRef(false);

  // Olympus Jackpot state
  const [jackpotMeterTokens, setJackpotMeterTokens] = useState(0);
  const [lastJackpotWin, setLastJackpotWin] = useState<TitanJackpotTriggered | null>(null);
  const currentRoundIdRef = useRef<string | null>(null);

  // Queue ALL balance updates while spin animation is in flight.
  // On idle, flush the last server balance as source of truth.
  const spinAnimatingRef = useRef(false);
  const queuedBalanceRef = useRef<string | null>(null);

  const flushQueuedBalance = useCallback(() => {
    spinAnimatingRef.current = false;
    const queued = queuedBalanceRef.current;
    if (queued) {
      queuedBalanceRef.current = null;
      ws.setBalance(queued);
    }
  }, [ws.setBalance]);

  const error = gameError || ws.error;

  // JOIN response may include server balance=0 which overwrites the real
  // lobby balance. Wait until session is ready, then seed from lobby.
  // During joining the user sees "Forging connection…" — no flash.
  useEffect(() => {
    if (ws.sessionReady && initialBalance) {
      ws.setBalance(initialBalance);
    }
  }, [ws.sessionReady, initialBalance, ws.setBalance]);

  // Resume previous spin from join lastRound
  useEffect(() => {
    const lr = ws.lastRound;
    if (lr && !lastSpin && lr.spin && lr.round && lr.state) {
      setLastSpin(parseTitanSpinPayload(lr as Record<string, unknown>));
    }
  }, [ws.lastRound, lastSpin]);

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
    spinAnimatingRef.current = true;

    // Optimistic: deduct bet from displayed balance immediately.
    const curBal = Number(ws.balance);
    const betNum = Number(selectBetValue);
    if (Number.isFinite(curBal) && Number.isFinite(betNum)) {
      ws.setBalance(String(Math.max(0, curBal - betNum)));
    }

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

      setLastSpin(parsed);

      const poolsFromSpin = parseJackpotPoolsFromPayload(raw);
      if (poolsFromSpin) ws.applyJackpotPools(poolsFromSpin);

      spinBusyRef.current = false;
      return parsed;
    } catch (e) {
      setIsSpinning(false);
      spinBusyRef.current = false;
      flushQueuedBalance(); // apply queued balance even on error
      const msg = e instanceof Error ? e.message : String(e);
      if (!client.isConnected() || isWsConnectionLost(msg)) {
        callbacks.onConnectionLost(msg);
      } else {
        setGameError(msg);
      }
      return null;
    }
  }, [selectBetValue, superBetActive, ws, callbacks]);

  // --- balance push listener (1501) ---
  // During spin animation ALL balance updates are queued.
  // The server balance is the source of truth — flushed when effects complete.
  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client || !ws.sessionReady) return;
    const cleanup = client.addPayloadListener(isTitanBalanceUpdate, (payload) => {
      const bal = payload.balance;
      if (typeof bal !== "number" || !Number.isFinite(bal)) return;
      const balStr = String(bal);
      if (spinAnimatingRef.current) {
        queuedBalanceRef.current = balStr;
        return;
      }
      ws.setBalance(balStr);
    });
    return cleanup;
  }, [ws.clientRef, ws.sessionReady, ws.setBalance]);

  // --- error listener for spin errors arriving as pushes ---
  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client) return;
    const cleanup = client.addPayloadListener(isTitanSpinError, (payload) => {
        const c = typeof payload.c === "number" ? payload.c : 0;
        const mgs = typeof payload.mgs === "string" ? payload.mgs : undefined;
        const msg = formatTitanError(c, mgs);
        setGameError(msg);
        setIsSpinning(false);
        spinBusyRef.current = false;
        flushQueuedBalance();
        // Auto-retry hint for lock errors
        if (c === 1310) {
          window.setTimeout(() => { /* UI can prompt retry */ }, 500);
        }
        // Auto re-join for session/state errors
        if (c === 1305 || c === 1312) {
          void ws.joinGame();
        }
    });
    return cleanup;
  }, [ws.clientRef, ws.joinGame]);

  // --- jackpot listener (1502) ---
  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client || !ws.sessionReady) return;
    const cleanup = client.addPayloadListener(isTitanJackpotTriggered, (payload) => {
      const tier = (payload.tier as TitanJackpotTier) ?? "MINI";
      const prizeAmount = typeof payload.prizeAmount === "number" ? payload.prizeAmount : 0;
      const tokenCount = typeof payload.tokenCount === "number" ? payload.tokenCount : 0;
      setLastJackpotWin({
        cmd: 1502,
        c: 0,
        tier,
        prizeAmount,
        tokenCount,
        playerId: String(payload.playerId ?? ""),
      });
    });
    return cleanup;
  }, [ws.clientRef, ws.sessionReady]);

  // --- jackpot meter: reset on new round, accumulate tokens ---
  useEffect(() => {
    if (!lastSpin) return;
    const roundId = lastSpin.round.roundId;
    // New round → reset meter
    if (roundId !== currentRoundIdRef.current) {
      currentRoundIdRef.current = roundId;
      setJackpotMeterTokens(0);
      setLastJackpotWin(null);
    }
    // Accumulate tokens from this spin
    const tokens = lastSpin.spin.tokenPositions;
    if (tokens.length > 0) {
      setJackpotMeterTokens((prev) => prev + tokens.length);
    }
  }, [lastSpin]);

  const dismissJackpotCelebration = useCallback(() => {
    setLastJackpotWin(null);
  }, []);

  // --- view state ---
  const viewSpin = lastSpin;

  const lockedReels = viewSpin?.state?.titanWild?.lockedReels ?? [];
  const respinPending = viewSpin ? isTitanRespinPending(viewSpin) : false;
  const paylineWins = viewSpin?.spin?.paylineWins ?? [];
  const totalWin = viewSpin?.round?.totalWin ?? 0;

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
    setSuperBetActive: (v: boolean) => { if (superBetToggleable || !v) setSuperBetActive(v); },
    superBetToggleable,
    respinPending,
    paylineWins,
    totalWin,
    gameError,
    setGameError,
    endSpinCycle: flushQueuedBalance,
    // Olympus Jackpot
    jackpotMeterTokens,
    lastJackpotWin,
    dismissJackpotCelebration,
  };
}

export type TitanSession = ReturnType<typeof useTitanSession>;
