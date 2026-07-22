import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWsSession, type WsSessionCallbacks } from "../../ws/useWsSession";
import { parseAngkorMessage } from "./lib/message-parser";
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
  spinFrame,
  cheatFrame,
  forceJackpotNextSpinFrame,
  historyListFrame,
  HISTORY_LIST_DEFAULT_SIZE,
  historyDetailFrame,
  jackpotWinHistoryFrame,
} from "../../ws/frames";
import {
  parseHistoryListPayload,
  parseHistoryDetailPayload,
  parseJackpotPoolsFromPayload,
  readTopLevelBalance,
  type JackpotTier,
  type JackpotTierInfo,
  type SpinResponsePayload,
  type HistoryListPayload,
  type HistoryDetailPayload,
  type JackpotWinHistoryPayload,
  type LastRound,
} from "../../ws/protocol";

function parseBalanceAmount(balance: string | null): number | null {
  if (balance == null) return null;
  const n = Number(balance);
  return Number.isFinite(n) ? n : null;
}

const WS_CONNECTION_LOST_RE =
  /timeout|WS closed|WS connect error|not connected|Disconnected before|Disconnected after/i;

function isWsConnectionLostMessage(message: string): boolean {
  return WS_CONNECTION_LOST_RE.test(message);
}

function formatSpinErrorForUi(message: string): string {
  if (message.includes("BALANCE_NOT_ENOUGH"))
    return "Insufficient balance. Use + to deposit, then spin again.";
  if (message.includes("ROUND_SETTLE_PENDING"))
    return "Settlement pending. Retry spin in a moment.";
  return message;
}

export function useGameSession(
  wsUrl: string,
  gameId: string,
  agentId: string,
  jackpotTierInfo: JackpotTierInfo[],
  wsAccessToken: string,
  callbacks: WsSessionCallbacks,
  depositFunds: () => Promise<void>,
  agencyUserToken: string,
  balance: string | null,
  depositBusy: boolean,
) {
  const ws = useWsSession(wsUrl, gameId, agentId, jackpotTierInfo, wsAccessToken, callbacks, parseAngkorMessage);

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
  const [gameError, setGameError] = useState<string | null>(null);

  const displayBalance = balance;
  const error = gameError || ws.error;

  // --- apply cheat grid from spin reels ---
  const applyCheatGridFromReels = useCallback((reels: string[][]) => {
    const grid = cheatGridFromSpinReels(reels);
    setCheatGrid(grid);
    cheatBaselineRef.current = cloneCheatGrid(grid);
    setCheatGridDirty(false);
  }, []);

  // Apply last round reels from join
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.betLevels]);

  // --- derived state ---
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

  // --- spin ---
  const spin = useCallback(async (): Promise<SpinResponsePayload | null> => {
    const client = ws.clientRef.current;
    console.log("[Angkor] spin called", { connected: client?.isConnected(), phase: ws.phase, ready: ws.sessionReady, busy: spinBusyRef.current });
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady || spinBusyRef.current) {
      console.log("[Angkor] spin blocked", { connected: client?.isConnected(), phase: ws.phase, ready: ws.sessionReady });
      return null;
    }
    setGameError(null);
    spinBusyRef.current = true;
    setSpinFreeze(lastSpin ?? ws.lastRound);
    try {
      const payloadPromise = client.waitForPayload(isSpinResponsePayload, "spin response", {
        rejectMatcher: isSpinErrorPayload,
      });
      console.log("[Angkor] sending spin frame", spinFrame(ws.gameRoute, String(activeBet)));
      client.sendFrame(spinFrame(ws.gameRoute, String(activeBet)));
      const payload = await payloadPromise;
      const spinPayload = payload as unknown as SpinResponsePayload;
      const bal = readTopLevelBalance(payload);
      if (bal) ws.setBalance(bal);
      setLastSpin(spinPayload);
      applyCheatGridFromReels(spinPayload.spin.reels);

      const poolsFromSpin = parseJackpotPoolsFromPayload(payload);
      if (poolsFromSpin) ws.applyJackpotPools(poolsFromSpin);
      else void ws.fetchJackpotPools();

      if (cheatArmed || forceJackpotArmed) {
        setCheatArmed(false);
        setForceJackpotArmed(false);
      }
      spinBusyRef.current = false;
      setSpinFreeze(null);
      return spinPayload;
    } catch (e) {
      console.log("[Angkor] spin error:", e);
      const message = e instanceof Error ? e.message : String(e);
      if (!client.isConnected() || isWsConnectionLostMessage(message)) {
        callbacks.onConnectionLost(message);
      } else {
        setGameError(formatSpinErrorForUi(message));
      }
      return null;
    } finally {
      spinBusyRef.current = false;
      setSpinFreeze(null);
    }
  }, [lastSpin, ws.lastRound, activeBet, cheatArmed, forceJackpotArmed, ws, callbacks]);

  // --- cheat ---
  const sendCheat = useCallback(() => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady) return;
    setGameError(null);
    const parsed = validateCheatReels(cheatGrid);
    if (!parsed.reels) { setGameError(parsed.error ?? "Invalid cheat reels input."); return; }
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
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady) {
      throw new Error("Connect and join the game before arming jackpot cheat.");
    }
    setGameError(null);
    setForceJackpotBusy(true);
    try {
      const payloadPromise = client.waitForPayload(isForceJackpotResponse, "force jackpot");
      client.sendFrame(forceJackpotNextSpinFrame(ws.gameRoute, tier));
      await payloadPromise;
      setForceJackpotArmed(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setGameError(message);
      throw e;
    } finally { setForceJackpotBusy(false); }
  }, [ws]);

  const updateCheatCell = useCallback(
    (reelIndex: number, rowIndex: number, colLen: number, value: string) => {
      if (!isAllowedCheatSymbolInput(value)) { setCheatInputRejectTick((t) => t + 1); return; }
      setCheatGrid((prev) => {
        const next = setCheatCellValue(prev, reelIndex, rowIndex, colLen, value);
        setCheatGridDirty(!cheatGridsEqual(next, cheatBaselineRef.current));
        return next;
      });
    }, [],
  );

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

  // --- can-spin / can-cheat ---
  const canSpin =
    ws.phase === "joined" && ws.sessionReady && ws.betLevels.length > 0 && ws.betLevels.includes(activeBet);
  const canCheat = ws.phase === "joined" && ws.sessionReady;

  const balanceAmount = parseBalanceAmount(displayBalance);
  const canDeposit =
    ws.sessionReady && agencyUserToken.trim() !== "" && !depositBusy &&
    balanceAmount != null && balanceAmount < 50_000;

  // --- win ways / celebrations ---
  const winWays = viewSpin?.spin?.winWays ?? [];
  const jackpotInfo = useMemo(() => (viewSpin?.spin ? readSpinJackpot(viewSpin.spin) : null), [viewSpin]);
  const retriggerInfo = useMemo(() => (viewSpin?.spin ? readSpinRetrigger(viewSpin.spin) : null), [viewSpin]);
  const goldenWildHighlightKeys = useMemo(
    () => buildGoldenWildHighlightSet(jackpotInfo?.goldenWildPositions), [jackpotInfo],
  );
  const featureBadges = useMemo(() => readRoundFeatureBadges(viewSpin), [viewSpin]);

  const selectBetValue =
    ws.betLevels.length > 0 && ws.betLevels.includes(activeBet) ? activeBet : (ws.betLevels[0] ?? "");

  const busySession =
    ws.phase === "connecting" || ws.phase === "connected" || ws.phase === "joining";

  return {
    ...ws,
    error,
    setGameError,
    gameError,
    bet, setBet,
    betLevels: ws.betLevels,
    selectBetValue,
    lastSpin,
    isSpinning,
    displaySpin,
    viewSpin,
    betLocked,
    activeBet,
    spin, canSpin, canCheat,
    cheatGrid, cheatGridDirty, cheatInputRejectTick, cheatArmed,
    sendCheat, discardCheatGrid, updateCheatCell,
    forceJackpotArmed, forceJackpotBusy, sendForceJackpot,
    fetchHistoryList, fetchHistoryDetail, fetchJackpotWinHistory,
    winWays, jackpotInfo, retriggerInfo, goldenWildHighlightKeys, featureBadges,
    cheatSymbolOptions: CHEAT_SYMBOL_OPTIONS,
    canDeposit,
    depositBusy,
    depositFunds,
    busySession,
  };
}

export type AngkorGameSession = ReturnType<typeof useGameSession>;
