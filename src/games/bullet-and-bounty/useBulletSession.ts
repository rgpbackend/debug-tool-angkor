import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWsSession, type WsSessionCallbacks } from "../../ws/useWsSession";
import { resolveBetFromLevels } from "../../lib/session-utils";
import { parseBulletMessage } from "./bullet-message-parser";
import { bulletSelectFreeSpinModeFrame, bulletSpinFrame, BULLET_GAME_ROUTE } from "./bullet-frames";
import {
  formatBulletError,
  isBulletBalanceUpdate,
  isBulletModeError,
  isBulletModeResponse,
  isBulletSessionTakenOver,
  isBulletSpinError,
  isBulletSpinResponse,
  parseBulletSpinPayload,
  parseFreeSpinFromRound,
  parseReelsFromLastRound,
  type BulletFreeSpinState,
  type BulletSpinPayload,
} from "./bullet-protocol";

const WS_CONNECTION_LOST_RE =
  /timeout|WS closed|WS connect error|not connected|Disconnected before|Disconnected after/i;

function isWsConnectionLost(msg: string): boolean {
  return WS_CONNECTION_LOST_RE.test(msg);
}

const BULLET_AGENT_ID = "AGENCY_001";

export function useBulletSession(
  wsUrl: string,
  wsAccessToken: string,
  callbacks: WsSessionCallbacks,
  initialBalance?: string | null,
) {
  const wrappedCallbacks: WsSessionCallbacks = {
    onTokenBan: () => {
      console.error("[BULLET] onTokenBan → logout");
      callbacks.onTokenBan();
    },
    onConnectionLost: (msg: string) => {
      console.error("[BULLET] onConnectionLost:", msg);
      callbacks.onConnectionLost(msg);
    },
  };

  const ws = useWsSession(
    wsUrl,
    BULLET_GAME_ROUTE,
    BULLET_AGENT_ID,
    [],
    wsAccessToken,
    wrappedCallbacks,
    parseBulletMessage,
  );

  const [bet, setBet] = useState<string>("");
  const [fsRound, setFsRound] = useState<{
    freeSpin: BulletFreeSpinState | null;
    roundBet: string | null;
  }>({ freeSpin: null, roundBet: null });
  const [lastSpin, setLastSpin] = useState<BulletSpinPayload | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const spinBusyRef = useRef(false);

  const error = gameError || ws.error;
  const setBalance = ws.setBalance;

  useEffect(() => {
    if (ws.sessionReady && initialBalance) {
      setBalance(initialBalance);
    }
  }, [ws.sessionReady, initialBalance, setBalance]);

  // Server (1005 join response) is the only source of bet levels.
  const betLevels = ws.betLevels;

  const selectBetValue = useMemo(
    () => resolveBetFromLevels(betLevels, bet),
    [betLevels, bet],
  );

  const reels = useMemo(() => {
    if (lastSpin) return lastSpin.reels;
    return parseReelsFromLastRound(ws.lastRound as Record<string, unknown> | null);
  }, [lastSpin, ws.lastRound]);

  // Free-spin state: seeded from 1005 lastRound, advanced by each 1500/1507 response.
  useEffect(() => {
    if (!ws.sessionReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed from server round state
    setFsRound(parseFreeSpinFromRound(ws.lastRound as Record<string, unknown> | null));
  }, [ws.sessionReady, ws.lastRound]);

  const freeSpin = fsRound.freeSpin;
  const pendingChoice = freeSpin?.awaitingChoice ? freeSpin.choiceOptions : null;
  const awaitingChoice = !!freeSpin?.awaitingChoice;
  const freeSpinActive = !!freeSpin && !freeSpin.awaitingChoice && freeSpin.spinsLeft > 0;

  const canSpin = ws.phase === "joined" && ws.sessionReady && !isSpinning && !pendingChoice;

  const spin = useCallback(async (): Promise<BulletSpinPayload | null> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady || spinBusyRef.current) {
      return null;
    }
    // Free spins ride the same 1500 with the round's own bet; server does not debit.
    const freeSpinBet = Number(fsRound.roundBet);
    const inFreeSpin = freeSpinActive;
    const betNum =
      inFreeSpin && Number.isFinite(freeSpinBet) ? freeSpinBet : Number(selectBetValue);
    if (!Number.isFinite(betNum) || (!inFreeSpin && !ws.betLevels.length)) return null;
    if (pendingChoice) return null;
    setGameError(null);
    spinBusyRef.current = true;

    const curBal = Number(ws.balance);
    if (!inFreeSpin && Number.isFinite(curBal)) {
      ws.setBalance(String(Math.max(0, curBal - betNum)));
    }

    setIsSpinning(true);
    try {
      const payloadPromise = client.waitForPayload(isBulletSpinResponse, "bullet spin", {
        rejectMatcher: isBulletSpinError,
      });
      client.sendFrame(bulletSpinFrame(betNum));
      const raw = await payloadPromise;
      const parsed = parseBulletSpinPayload(raw);
      setLastSpin(parsed);
      setFsRound((prev) => ({
        freeSpin: parsed.freeSpin,
        roundBet: parsed.roundBet ?? prev.roundBet,
      }));
      if (parsed.balance) {
        ws.setBalance(parsed.balance);
      }
      setIsSpinning(false);
      spinBusyRef.current = false;
      return parsed;
    } catch (e) {
      setIsSpinning(false);
      spinBusyRef.current = false;
      const msg = e instanceof Error ? e.message : String(e);
      if (!client.isConnected() || isWsConnectionLost(msg)) {
        callbacks.onConnectionLost(msg);
      } else {
        setGameError(msg);
      }
      return null;
    }
  }, [selectBetValue, ws, callbacks, freeSpinActive, fsRound, pendingChoice]);

  // Plain function: reads clientRef.current, so manual memoization trips the compiler lint.
  const selectFreeSpinMode = async (mode: string): Promise<boolean> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || !awaitingChoice || spinBusyRef.current) {
      return false;
    }
    setGameError(null);
    // Do not set isSpinning: cmd 1507 returns no grid, and the reel theater
    // would wait forever for reels to change (base spin → FS choice hang).
    spinBusyRef.current = true;
    try {
      const payloadPromise = client.waitForPayload(isBulletModeResponse, "fs mode", {
        rejectMatcher: isBulletModeError,
      });
      client.sendFrame(bulletSelectFreeSpinModeFrame(mode));
      const raw = await payloadPromise;
      const parsed = parseBulletSpinPayload(raw);
      setFsRound((prev) => ({
        freeSpin: parsed.freeSpin ?? prev.freeSpin,
        roundBet: parsed.roundBet ?? prev.roundBet,
      }));
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!client.isConnected() || isWsConnectionLost(msg)) {
        callbacks.onConnectionLost(msg);
      } else {
        setGameError(msg);
      }
      return false;
    } finally {
      spinBusyRef.current = false;
    }
  };

  // ws.clientRef is stable; read .current only inside these effects.
  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client || !ws.sessionReady) return;
    return client.addPayloadListener(isBulletBalanceUpdate, (payload) => {
      const bal = payload.balance;
      if (typeof bal === "string") setBalance(bal);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clientRef
  }, [ws.sessionReady, setBalance]);

  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client) return;
    return client.addPayloadListener(isBulletSpinError, (payload) => {
      const c = typeof payload.c === "number" ? payload.c : 0;
      const mgs = typeof payload.mgs === "string" ? payload.mgs : undefined;
      setGameError(formatBulletError(c, mgs));
      setIsSpinning(false);
      spinBusyRef.current = false;
      if (c === 1305 || c === 1312 || c === 1315) {
        void ws.joinGame();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clientRef
  }, [ws.joinGame]);

  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client) return;
    return client.addPayloadListener(isBulletSessionTakenOver, () => {
      setSessionTakenOver(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clientRef
  }, [ws.phase]);

  const dismissSessionTakenOver = useCallback(() => {
    setSessionTakenOver(false);
    callbacks.onConnectionLost("Session taken over");
  }, [callbacks]);

  return {
    phase: ws.phase,
    sessionReady: ws.sessionReady,
    gameScreenActive: ws.gameScreenActive,
    joinGame: ws.joinGame,
    joinRetryOpen: ws.joinRetryOpen,
    joinRetryMessage: ws.joinRetryMessage,
    joinRetryBusy: ws.joinRetryBusy,
    retryJoinGame: ws.retryJoinGame,
    dismissJoinRetry: ws.dismissJoinRetry,
    error,
    setGameError,
    balance: ws.balance,
    betLevels,
    symbolCatalog: ws.symbolCatalog,
    bet: selectBetValue,
    setBet,
    spin,
    canSpin,
    isSpinning,
    lastSpin,
    reels,
    // WIN box shows this spin's own win (spin.winAmount); round.totalWin stays "0" until settle.
    totalWin: lastSpin?.spinWin ?? null,
    winSymbols: lastSpin?.winSymbols ?? [],
    freeSpin,
    pendingChoice,
    freeSpinActive,
    selectFreeSpinMode,
    sessionTakenOver,
    dismissSessionTakenOver,
    clientRef: ws.clientRef,
  };
}

export type BulletSession = ReturnType<typeof useBulletSession>;
