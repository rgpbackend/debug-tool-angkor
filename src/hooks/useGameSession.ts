import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readEnvDefaults } from "../config";
import {
  CHEAT_SYMBOL_OPTIONS,
  cheatGridFromSpinReels,
  emptyCheatGrid,
  setCheatCellValue,
  validateCheatReels,
} from "../lib/cheat";
import {
  buildGoldenWildHighlightSet,
  parseBetLevelsFromJoin,
  readRoundBetString,
  readRoundFeatureBadges,
  readSpinJackpot,
  readSpinRetrigger,
  resolveBetFromLevels,
} from "../lib/session-utils";
import {
  BrowserWsClient,
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
  parseJackpotPoolsFromPayload,
  type HistoryDetailPayload,
  type HistoryListPayload,
  type JoinResponsePayload,
  type JackpotPool,
  type JackpotPoolsByTier,
  type JackpotPoolsPayload,
  type JackpotWinHistoryPayload,
  type LastRound,
  type SpinResponsePayload,
} from "../ws/protocol";
import type { GamePhase } from "../ws/game-phase";

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

  const [wsUrl, setWsUrl] = useState(defaults.wsUrl);
  const [agentId, setAgentId] = useState(defaults.agentId);
  const [accessToken, setAccessToken] = useState(defaults.accessToken);
  const [gameRoute, setGameRoute] = useState(defaults.gameRoute);
  const [bet, setBet] = useState("1");
  const [betLevels, setBetLevels] = useState<string[]>([]);
  const [cheatGrid, setCheatGrid] = useState<string[][]>(() =>
    emptyCheatGrid(),
  );

  const [lastSpin, setLastSpin] = useState<SpinResponsePayload | null>(null);
  const [lastRound, setLastRound] = useState<LastRound | null>(null);
  /** Snapshot of round view at spin start; keeps reels / win ways stable while spinning. */
  const [spinFreeze, setSpinFreeze] = useState<
    SpinResponsePayload | LastRound | null
  >(null);
  const [cheatStatus, setCheatStatus] = useState<string | null>(null);
  const [cheatArmed, setCheatArmed] = useState(false);
  const [forceJackpotArmed, setForceJackpotArmed] = useState(false);


  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
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

  const disconnect = useCallback(() => {
    stopHeartbeat();
    clientRef.current?.close();
    clientRef.current = null;
    setError(null);
    setLastSpin(null);
    setSessionReady(false);
    setCheatArmed(false);
    setForceJackpotArmed(false);
    setCheatStatus(null);
    setCheatGrid(emptyCheatGrid());
    setLastRound(null);
    setJackpotPoolsByTier(emptyJackpotPoolsByTier());
    setJackpotPoolsLoading(false);
    setJackpotWinnersRefreshToken(0);
    setBetLevels([]);
    setActiveTab("game");
    spinBusyRef.current = false;
    setSpinFreeze(null);
    setPhase("disconnected");
  }, [stopHeartbeat]);

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
    setCheatGrid(emptyCheatGrid());
    setCheatArmed(false);
    setForceJackpotArmed(false);
    setCheatStatus(null);
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
      }

      const levels = parseBetLevelsFromJoin(joinPayload);
      setBetLevels(levels);
      const roundBet = joinPayload.lastRound?.round
        ? readRoundBetString(
            joinPayload.lastRound.round as { bet: unknown },
          )
        : null;
      setBet(resolveBetFromLevels(levels, roundBet ?? bet));

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
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
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
    disconnect,
    gameRoute,
    startHeartbeat,
    stopHeartbeat,
    wsUrl,
    fetchJackpotPools,
    applyJackpotPoolsFromPayload,
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
      setCheatGrid(cheatGridFromSpinReels(spinPayload.spin.reels));

      const poolsFromSpin = parseJackpotPoolsFromPayload(payload);
      if (poolsFromSpin) {
        applyJackpotPools(poolsFromSpin);
      } else {
        void fetchJackpotPools();
      }
      if (cheatArmed || forceJackpotArmed) {
        if (cheatArmed && forceJackpotArmed) {
          setCheatStatus("Cheat and force jackpot consumed on latest spin.");
        } else if (cheatArmed) {
          setCheatStatus("Cheat consumed on latest spin.");
        } else {
          setCheatStatus("Force jackpot consumed on latest spin.");
        }
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
      setCheatStatus("Cheat set for next spin.");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }, [cheatGrid, gameRoute, phase, sessionReady]);

  const sendForceJackpot = useCallback(() => {
    const client = clientRef.current;
    if (!client?.isConnected() || phase !== "joined" || !sessionReady) {
      return;
    }

    setError(null);
    try {
      const frame = forceJackpotNextSpinFrame(gameRoute.trim());
      client.sendFrame(frame);
      setForceJackpotArmed(true);
      setCheatStatus("Force jackpot set for next spin.");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }, [gameRoute, phase, sessionReady]);

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
      return payload as unknown as HistoryListPayload;
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
    async (roundId: string, spinId: string): Promise<HistoryDetailPayload> => {
      const client = clientRef.current;
      if (!client?.isConnected()) {
        throw new Error("Not connected");
      }
      const payloadPromise = client.waitForPayload(
        isHistoryDetailPayload,
        "history detail",
      );
      client.sendFrame(historyDetailFrame(gameRoute.trim(), roundId, spinId));
      const payload = await payloadPromise;
      return payload as unknown as HistoryDetailPayload;
    },
    [gameRoute],
  );

  const updateCheatCell = useCallback(
    (reelIndex: number, rowIndex: number, colLen: number, value: string) => {
      setCheatGrid((prev) =>
        setCheatCellValue(prev, reelIndex, rowIndex, colLen, value),
      );
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
    cheatGrid,
    cheatStatus,
    connectAndJoin,
    disconnect,
    spin,
    sendCheat,
    sendForceJackpot,
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
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
