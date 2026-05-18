import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readEnvDefaults } from "../config";
import {
  CHEAT_SYMBOL_OPTIONS,
  cheatGridFromSpinReels,
  cheatGridsEqual,
  cloneCheatGrid,
  emptyCheatGrid,
  setCheatCellValue,
  validateCheatReels,
} from "../lib/cheat";
import {
  buildGoldenWildHighlightSet,
  parseBetLevelsFromJoin,
  readBalanceString,
  readRoundBetString,
  readRoundFeatureBadges,
  readSpinJackpot,
  readSpinRetrigger,
  resolveBetFromLevels,
} from "../lib/session-utils";
import { resetAccessToken } from "../api/resetToken";
import {
  BrowserWsClient,
  StompTokenBannedError,
  isForceJackpotResponse,
  isHistoryDetailPayload,
  isHistoryListPayload,
  isJackpotPoolsPayload,
  isJackpotPoolsPushPayload,
  isJackpotWinHistoryPayload,
  isJackpotWinnerPush,
  isJoinResponsePayload,
  isSpinResponsePayload,
} from "../ws/browser-ws-client";
import {
  cheatFrame,
  connectFrame,
  forceJackpotNextSpinFrame,
  heartbeatFrame,
  historyDetailFrame,
  historyListFrame,
  jackpotPoolsFrame,
  jackpotWinHistoryFrame,
  joinFrame,
  spinFrame,
} from "../ws/frames";
import {
  emptyJackpotPoolsByTier,
  mergeJackpotPools,
  parseHistoryDetailPayload,
  parseHistoryListPayload,
  parseJackpotPoolsFromPayload,
  type HistoryDetailPayload,
  type HistoryListPayload,
  type JoinResponsePayload,
  type JackpotPool,
  type JackpotTier,
  type JackpotPoolsByTier,
  type JackpotPoolsPayload,
  type JackpotWinHistoryPayload,
  type LastRound,
  type SpinResponsePayload,
} from "../ws/protocol";
import type { GamePhase } from "../ws/game-phase";
import { isTokenBannedStompError } from "../ws/stomp-errors";

const HEARTBEAT_INTERVAL_MS = 30_000;
const POST_AUTH_BEFORE_JOIN_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useGameSession() {
  const defaults = useMemo(() => readEnvDefaults(), []);
  const clientRef = useRef<BrowserWsClient | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  /** True while awaiting spin response — blocks jackpot loading UI churn. */
  const spinBusyRef = useRef(false);
  const stompListenerCleanupRef = useRef<(() => void) | null>(null);
  const cheatBaselineRef = useRef<string[][]>(emptyCheatGrid());

  const [activeTab, setActiveTab] = useState<"game" | "history" | "jackpots">(
    "game",
  );
  const [jackpotPoolsByTier, setJackpotPoolsByTier] =
    useState<JackpotPoolsByTier>(emptyJackpotPoolsByTier);
  const [jackpotPoolsLoading, setJackpotPoolsLoading] = useState(false);
  const [jackpotWinnersRefreshToken, setJackpotWinnersRefreshToken] =
    useState(0);
  const [phase, setPhase] = useState<GamePhase>("disconnected");
  /** True after connect+join succeeded; used for UI (avoid reading refs during render). */
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenBanPromptOpen, setTokenBanPromptOpen] = useState(false);
  const [tokenResetBusy, setTokenResetBusy] = useState(false);

  const [wsUrl, setWsUrl] = useState(defaults.wsUrl);
  const [agentId, setAgentId] = useState(defaults.agentId);
  const [accessToken, setAccessToken] = useState(defaults.accessToken);
  const [gameRoute, setGameRoute] = useState(defaults.gameRoute);
  const [bet, setBet] = useState("1");
  const [betLevels, setBetLevels] = useState<string[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [cheatGrid, setCheatGrid] = useState<string[][]>(() =>
    emptyCheatGrid(),
  );

  const [lastSpin, setLastSpin] = useState<SpinResponsePayload | null>(null);
  const [lastRound, setLastRound] = useState<LastRound | null>(null);
  /** Snapshot of round view at spin start; keeps reels / win ways stable while spinning. */
  const [spinFreeze, setSpinFreeze] = useState<
    SpinResponsePayload | LastRound | null
  >(null);
  const [cheatArmed, setCheatArmed] = useState(false);
  const [forceJackpotArmed, setForceJackpotArmed] = useState(false);
  const [forceJackpotBusy, setForceJackpotBusy] = useState(false);
  const [cheatGridDirty, setCheatGridDirty] = useState(false);


  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const applyCheatGridFromReels = useCallback((reels: string[][]) => {
    const grid = cheatGridFromSpinReels(reels);
    setCheatGrid(grid);
    cheatBaselineRef.current = cloneCheatGrid(grid);
    setCheatGridDirty(false);
  }, []);

  const startHeartbeat = useCallback(
    (client: BrowserWsClient) => {
      stopHeartbeat();
      heartbeatTimerRef.current = window.setInterval(() => {
        if (clientRef.current !== client || !client.isConnected()) {
          stopHeartbeat();
          return;
        }
        try {
          client.sendFrame(heartbeatFrame());
        } catch {
          stopHeartbeat();
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    [stopHeartbeat],
  );

  const detachStompListener = useCallback(() => {
    stompListenerCleanupRef.current?.();
    stompListenerCleanupRef.current = null;
  }, []);

  const handleTokenBan = useCallback(() => {
    setTokenBanPromptOpen(true);
    setError("Access token has been banned.");
    stopHeartbeat();
    detachStompListener();
    clientRef.current?.close();
    clientRef.current = null;
    setSessionReady(false);
    setPhase("disconnected");
  }, [detachStompListener, stopHeartbeat]);

  const dismissTokenBanPrompt = useCallback(() => {
    setTokenBanPromptOpen(false);
  }, []);

  const confirmTokenReset = useCallback(async () => {
    const token = accessToken.trim();
    if (!token) {
      setError("Access token is required to reset");
      return;
    }
    setTokenResetBusy(true);
    try {
      await resetAccessToken(defaults.tokenResetBaseUrl, token);
      setTokenBanPromptOpen(false);
      setError("Token reset succeeded. Connect again with the same token.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTokenResetBusy(false);
    }
  }, [accessToken, defaults.tokenResetBaseUrl]);

  const disconnect = useCallback(() => {
    detachStompListener();
    stopHeartbeat();
    clientRef.current?.close();
    clientRef.current = null;
    setError(null);
    setLastSpin(null);
    setSessionReady(false);
    setCheatArmed(false);
    setForceJackpotArmed(false);
    setCheatGrid(emptyCheatGrid());
    cheatBaselineRef.current = emptyCheatGrid();
    setCheatGridDirty(false);
    setLastRound(null);
    setJackpotPoolsByTier(emptyJackpotPoolsByTier());
    setJackpotPoolsLoading(false);
    setJackpotWinnersRefreshToken(0);
    setBetLevels([]);
    setBalance(null);
    setActiveTab("game");
    spinBusyRef.current = false;
    setSpinFreeze(null);
    setTokenBanPromptOpen(false);
    setTokenResetBusy(false);
    setPhase("disconnected");
  }, [detachStompListener, stopHeartbeat]);

  const applyJackpotPools = useCallback((pools: JackpotPool[]) => {
    if (pools.length === 0) {
      return;
    }
    setJackpotPoolsByTier((prev) => mergeJackpotPools(prev, pools));
  }, []);

  const applyJackpotPoolsFromPayload = useCallback(
    (payload: Record<string, unknown>) => {
      const pools = parseJackpotPoolsFromPayload(payload);
      if (pools) {
        applyJackpotPools(pools);
      }
    },
    [applyJackpotPools],
  );

  const fetchJackpotPools = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.isConnected() || spinBusyRef.current) {
      return;
    }
    setJackpotPoolsLoading(true);
    try {
      const payloadPromise = client.waitForPayload(
        isJackpotPoolsPayload,
        "jackpot pools",
      );
      client.sendFrame(jackpotPoolsFrame(gameRoute.trim()));
      const payload = await payloadPromise;
      const poolsPayload = payload as unknown as JackpotPoolsPayload;
      applyJackpotPools(poolsPayload.pools);
    } catch {
      // Pool fetch is best-effort; UI still works via push 1520.
    } finally {
      setJackpotPoolsLoading(false);
    }
  }, [applyJackpotPools, gameRoute]);

  const connectAndJoin = useCallback(async () => {
    setError(null);
    setLastSpin(null);
    setLastRound(null);
    setBalance(null);
    setCheatGrid(emptyCheatGrid());
    setCheatArmed(false);
    setForceJackpotArmed(false);
    if (!wsUrl.trim()) {
      setError("WebSocket URL is required");
      return;
    }
    if (!accessToken.trim()) {
      setError("Access token is required");
      return;
    }

    disconnect();
    setSessionReady(false);
    setPhase("connecting");

    const timeoutMs = defaults.timeoutMs;
    const client = new BrowserWsClient(wsUrl.trim(), { timeoutMs });
    clientRef.current = client;

    try {
      await client.connect();
      if (clientRef.current !== client) {
        return;
      }

      detachStompListener();
      stompListenerCleanupRef.current = client.addStompErrorListener((code) => {
        if (isTokenBannedStompError(code)) {
          handleTokenBan();
        }
      });

      const connect = connectFrame(agentId.trim(), accessToken.trim(), false);
      client.sendFrame(connect);
      setPhase("connected");
      startHeartbeat(client);

      await delay(POST_AUTH_BEFORE_JOIN_MS);
      if (clientRef.current !== client) {
        return;
      }
      if (!client.isConnected()) {
        const closeInfo = client.getLastCloseInfo();
        const detail = closeInfo
          ? `code=${closeInfo.code} reason=${closeInfo.reason}`
          : "socket not open";
        throw new Error(`Disconnected before join (${detail})`);
      }

      const joinPayloadPromise = client.waitForPayload(
        isJoinResponsePayload,
        "join response",
      );
      const join = joinFrame(gameRoute.trim());
      client.sendFrame(join);

      const joinPayload =
        (await joinPayloadPromise) as unknown as JoinResponsePayload;

      if (clientRef.current !== client) {
        return;
      }
      if (!client.isConnected()) {
        const closeInfo = client.getLastCloseInfo();
        const detail = closeInfo
          ? `code=${closeInfo.code} reason=${closeInfo.reason}`
          : "socket not open";
        throw new Error(`Disconnected after connect/join (${detail})`);
      }

      if (joinPayload.lastRound) {
        setLastRound(joinPayload.lastRound);
        if (joinPayload.lastRound.spin?.reels) {
          applyCheatGridFromReels(joinPayload.lastRound.spin.reels);
        }
      }

      const levels = parseBetLevelsFromJoin(joinPayload);
      setBetLevels(levels);
      const roundBet = joinPayload.lastRound?.round
        ? readRoundBetString(
            joinPayload.lastRound.round as { bet: unknown },
          )
        : null;
      setBet(resolveBetFromLevels(levels, roundBet ?? bet));
      setBalance(readBalanceString(joinPayload as unknown as Record<string, unknown>));

      applyJackpotPoolsFromPayload(
        joinPayload as unknown as Record<string, unknown>,
      );

      setSessionReady(true);
      setPhase("joined");
      void fetchJackpotPools();
    } catch (e) {
      if (clientRef.current !== client) {
        return;
      }
      if (e instanceof StompTokenBannedError) {
        handleTokenBan();
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      detachStompListener();
      stopHeartbeat();
      client.close();
      clientRef.current = null;
      setSessionReady(false);
      setPhase("disconnected");
    }
  }, [
    accessToken,
    agentId,
    defaults.timeoutMs,
    detachStompListener,
    disconnect,
    gameRoute,
    handleTokenBan,
    startHeartbeat,
    stopHeartbeat,
    wsUrl,
    fetchJackpotPools,
    applyJackpotPoolsFromPayload,
    applyCheatGridFromReels,
  ]);

  useEffect(() => {
    const client = clientRef.current;
    if (!sessionReady || !client?.isConnected()) {
      return;
    }

    const removePoolsPush = client.addPayloadListener(
      isJackpotPoolsPushPayload,
      (payload) => {
        applyJackpotPoolsFromPayload(payload);
      },
    );

    const removeWinnerPush = client.addPayloadListener(
      isJackpotWinnerPush,
      () => {
        setJackpotWinnersRefreshToken((t) => t + 1);
      },
    );

    return () => {
      removePoolsPush();
      removeWinnerPush();
    };
  }, [applyJackpotPoolsFromPayload, sessionReady]);

  useEffect(
    () => () => {
      stopHeartbeat();
    },
    [stopHeartbeat],
  );

  const spin = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.isConnected() || phase !== "joined" || !sessionReady) {
      return;
    }
    setError(null);
    spinBusyRef.current = true;
    setSpinFreeze(lastSpin ?? lastRound);
    setPhase("spinning");
    try {
      const payloadPromise = client.waitForPayload(
        isSpinResponsePayload,
        "spin response",
      );
      const frame = spinFrame(gameRoute.trim(), String(bet));
      client.sendFrame(frame);
      const payload = await payloadPromise;
      const spinPayload = payload as unknown as SpinResponsePayload;
      setLastSpin(spinPayload);
      setLastRound(null);
      applyCheatGridFromReels(spinPayload.spin.reels);
      const nextBalance = readBalanceString(payload);
      if (nextBalance != null) {
        setBalance(nextBalance);
      }

      const poolsFromSpin = parseJackpotPoolsFromPayload(payload);
      if (poolsFromSpin) {
        applyJackpotPools(poolsFromSpin);
      } else {
        void fetchJackpotPools();
      }
      if (cheatArmed || forceJackpotArmed) {
        setCheatArmed(false);
        setForceJackpotArmed(false);
      }
      setPhase("joined");
      spinBusyRef.current = false;
      setSpinFreeze(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      if (client.isConnected()) {
        setPhase("joined");
      } else {
        clientRef.current = null;
        setSessionReady(false);
        setPhase("disconnected");
      }
    } finally {
      spinBusyRef.current = false;
      setSpinFreeze(null);
    }
  }, [
    lastSpin,
    lastRound,
    bet,
    cheatArmed,
    forceJackpotArmed,
    gameRoute,
    phase,
    applyJackpotPools,
    fetchJackpotPools,
    sessionReady,
  ]);

  const sendCheat = useCallback(() => {
    const client = clientRef.current;
    if (!client?.isConnected() || phase !== "joined" || !sessionReady) {
      return;
    }

    setError(null);
    const parsed = validateCheatReels(cheatGrid);
    if (!parsed.reels) {
      setError(parsed.error ?? "Invalid cheat reels input.");
      return;
    }

    try {
      const frame = cheatFrame(gameRoute.trim(), parsed.reels);
      client.sendFrame(frame);
      setCheatArmed(true);
      cheatBaselineRef.current = cloneCheatGrid(cheatGrid);
      setCheatGridDirty(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }, [cheatGrid, gameRoute, phase, sessionReady]);

  const sendForceJackpot = useCallback(
    async (tier: JackpotTier): Promise<void> => {
      const client = clientRef.current;
      if (!client?.isConnected() || phase !== "joined" || !sessionReady) {
        throw new Error("Connect and join the game before arming jackpot cheat.");
      }

      setError(null);
      setForceJackpotBusy(true);
      try {
        const payloadPromise = client.waitForPayload(
          isForceJackpotResponse,
          "force jackpot",
        );
        const frame = forceJackpotNextSpinFrame(gameRoute.trim(), tier);
        client.sendFrame(frame);
        await payloadPromise;
        setForceJackpotArmed(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        throw e;
      } finally {
        setForceJackpotBusy(false);
      }
    },
    [gameRoute, phase, sessionReady],
  );

  const fetchHistoryList = useCallback(
    async (page: number): Promise<HistoryListPayload> => {
      const client = clientRef.current;
      if (!client?.isConnected()) {
        throw new Error("Not connected");
      }
      const payloadPromise = client.waitForPayload(
        isHistoryListPayload,
        "history list",
      );
      client.sendFrame(historyListFrame(gameRoute.trim(), page, 20));
      const payload = await payloadPromise;
      return parseHistoryListPayload(payload);
    },
    [gameRoute],
  );

  const fetchJackpotWinHistory =
    useCallback(async (): Promise<JackpotWinHistoryPayload> => {
      const client = clientRef.current;
      if (!client?.isConnected()) {
        throw new Error("Not connected");
      }
      const payloadPromise = client.waitForPayload(
        isJackpotWinHistoryPayload,
        "jackpot win history",
      );
      client.sendFrame(jackpotWinHistoryFrame(gameRoute.trim(), 10));
      const payload = await payloadPromise;
      return payload as unknown as JackpotWinHistoryPayload;
    }, [gameRoute]);

  const fetchHistoryDetail = useCallback(
    async (roundId: string, spinIndex: number): Promise<HistoryDetailPayload> => {
      const client = clientRef.current;
      if (!client?.isConnected()) {
        throw new Error("Not connected");
      }
      const payloadPromise = client.waitForPayload(
        isHistoryDetailPayload,
        "history detail",
      );
      client.sendFrame(
        historyDetailFrame(gameRoute.trim(), roundId, spinIndex),
      );
      const payload = await payloadPromise;
      return parseHistoryDetailPayload(payload);
    },
    [gameRoute],
  );

  const updateCheatCell = useCallback(
    (reelIndex: number, rowIndex: number, colLen: number, value: string) => {
      setCheatGrid((prev) => {
        const next = setCheatCellValue(prev, reelIndex, rowIndex, colLen, value);
        setCheatGridDirty(!cheatGridsEqual(next, cheatBaselineRef.current));
        return next;
      });
    },
    [],
  );

  const canSpin =
    phase === "joined" &&
    sessionReady &&
    betLevels.length > 0 &&
    betLevels.includes(bet);
  const canCheat = phase === "joined" && sessionReady;
  const busyConnect = phase === "connecting" || phase === "connected";

  /** Unified display source: last spin result OR active round from join. */
  const displaySpin = lastSpin ?? lastRound;

  const isSpinning = phase === "spinning";

  /** Frozen during spin so reels / win ways do not flicker before the response. */
  const viewSpin = useMemo(() => {
    if (isSpinning && spinFreeze !== null) {
      return spinFreeze;
    }
    return displaySpin;
  }, [isSpinning, spinFreeze, displaySpin]);

  const betLocked = useMemo(() => {
    const round = displaySpin?.round;
    return Boolean(round && round.isFinished === false);
  }, [displaySpin]);

  useEffect(() => {
    if (!betLocked || !displaySpin?.round) {
      return;
    }
    const roundBet = readRoundBetString(displaySpin.round as { bet: unknown });
    if (!roundBet) {
      return;
    }
    setBet(resolveBetFromLevels(betLevels, roundBet));
  }, [betLocked, betLevels, displaySpin]);

  const selectBetValue =
    betLevels.length > 0 && betLevels.includes(bet) ? bet : (betLevels[0] ?? "");

  const winWays = viewSpin?.spin?.winWays ?? [];

  const jackpotInfo = useMemo(
    () => (viewSpin?.spin ? readSpinJackpot(viewSpin.spin) : null),
    [viewSpin],
  );
  const retriggerInfo = useMemo(
    () => (viewSpin?.spin ? readSpinRetrigger(viewSpin.spin) : null),
    [viewSpin],
  );
  const goldenWildHighlightKeys = useMemo(
    () => buildGoldenWildHighlightSet(jackpotInfo?.goldenWildPositions),
    [jackpotInfo],
  );
  const featureBadges = useMemo(
    () => readRoundFeatureBadges(viewSpin),
    [viewSpin],
  );

  return {
    activeTab,
    setActiveTab,
    jackpotPoolsByTier,
    jackpotPoolsLoading,
    jackpotWinnersRefreshToken,
    phase,
    sessionReady,
    error,
    setError,
    wsUrl,
    setWsUrl,
    agentId,
    setAgentId,
    accessToken,
    setAccessToken,
    gameRoute,
    setGameRoute,
    bet,
    setBet,
    betLevels,
    balance,
    cheatGrid,
    connectAndJoin,
    disconnect,
    spin,
    sendCheat,
    sendForceJackpot,
    forceJackpotBusy,
    fetchHistoryList,
    fetchHistoryDetail,
    fetchJackpotWinHistory,
    updateCheatCell,
    canSpin,
    canCheat,
    busyConnect,
    isSpinning,
    displaySpin,
    viewSpin,
    betLocked,
    selectBetValue,
    winWays,
    jackpotInfo,
    retriggerInfo,
    goldenWildHighlightKeys,
    featureBadges,
    cheatSymbolOptions: CHEAT_SYMBOL_OPTIONS,
    cheatGridDirty,
    tokenBanPromptOpen,
    tokenResetBusy,
    confirmTokenReset,
    dismissTokenBanPrompt,
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
