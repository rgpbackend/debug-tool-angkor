import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readEnvDefaults } from "../config";
import { getGames, type GameDef } from "../games";
import {
  CHEAT_SYMBOL_OPTIONS,
  isAllowedCheatSymbolInput,
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
  readRoundBetString,
  readRoundFeatureBadges,
  readSpinJackpot,
  readSpinRetrigger,
  resolveBetFromLevels,
} from "../lib/session-utils";
import { refreshSessionToken } from "../api/auth";
import { deposit, login as loginAgency, playGame, register } from "../api/agency";
import {
  clearGameSession,
  loadAgencyUserToken,
  loadLaunchedGameId,
  loadRefreshToken,
  saveAgencyUserToken,
  saveLaunchedGameId,
  saveRefreshToken,
} from "../lib/game-session-storage";
import { getWsSessionRefreshIntervalMs } from "../lib/ws-session-refresh";
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
  isGetBalanceErrorPayload,
  isGetBalanceResponsePayload,
  isSpinErrorPayload,
  isSpinResponsePayload,
} from "../ws/browser-ws-client";
import {
  cheatFrame,
  connectFrame,
  heartbeatFrame,
  forceJackpotNextSpinFrame,
  getBalanceFrame,
  historyDetailFrame,
  HISTORY_LIST_DEFAULT_SIZE,
  historyListFrame,
  jackpotPoolsFrame,
  jackpotWinHistoryFrame,
  joinFrame,
  spinFrame,
} from "../ws/frames";
import {
  mergeJackpotPools,
  parseHistoryDetailPayload,
  parseHistoryListPayload,
  parseJackpotPoolsFromPayload,
  parseGetBalancePayload,
  parseJoinResponsePayload,
  readTopLevelBalance,
  type GameSymbol,
  type HistoryDetailPayload,
  type HistoryListPayload,
  type JackpotPool,
  type JackpotTier,
  type JackpotPoolsByTier,
  type JackpotPoolsPayload,
  type JackpotTierInfo,
  type JackpotWinHistoryPayload,
  type LastRound,
  type SpinResponsePayload,
} from "../ws/protocol";
import type { GamePhase } from "../ws/game-phase";
import { isTokenBannedStompError } from "../ws/stomp-errors";

const POST_AUTH_BEFORE_JOIN_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const DEPOSIT_AMOUNT = 10_000;
const DEPOSIT_BALANCE_CAP = 50_000;

function parseBalanceAmount(balance: string | null): number | null {
  if (balance == null) {
    return null;
  }
  const n = Number(balance);
  return Number.isFinite(n) ? n : null;
}

const WS_CONNECTION_LOST_RE =
  /timeout|WS closed|WS connect error|not connected|Disconnected before|Disconnected after/i;

function isWsConnectionLostMessage(message: string): boolean {
  return WS_CONNECTION_LOST_RE.test(message);
}

function formatSpinErrorForUi(message: string): string {
  if (message.includes("BALANCE_NOT_ENOUGH")) {
    return "Insufficient balance. Use + to deposit, then spin again.";
  }
  if (message.includes("ROUND_SETTLE_PENDING")) {
    return "Settlement pending. Retry spin in a moment.";
  }
  return message;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useGameSession() {
  const defaults = useMemo(() => readEnvDefaults(), []);
  const clientRef = useRef<BrowserWsClient | null>(null);
  /** Game config set by launchGame / resumeFromRefreshToken. */
  const gameIdRef = useRef("");
  const agentIdRef = useRef("");
  const wsUrlRef = useRef(defaults.wsUrl);
  const jackpotTierInfoRef = useRef<JackpotTierInfo[]>([]);
  const heartbeatTimerRef = useRef<number | null>(null);
  const heartbeatCounterRef = useRef(1);
  const sessionRefreshTimerRef = useRef<number | null>(null);
  const sessionRefreshInFlightRef = useRef(false);
  /** True while awaiting spin response — blocks jackpot loading UI churn. */
  const spinBusyRef = useRef(false);
  const stompListenerCleanupRef = useRef<(() => void) | null>(null);
  const disconnectListenerCleanupRef = useRef<(() => void) | null>(null);
  const sessionReadyRef = useRef(false);
  const sessionEndingRef = useRef(false);
  const phaseRef = useRef<GamePhase>("disconnected");
  const cheatBaselineRef = useRef<string[][]>(emptyCheatGrid());
  const autoConnectStartedRef = useRef(false);

  const [jackpotPoolsByTier, setJackpotPoolsByTier] =
    useState<JackpotPoolsByTier>({});
  const [jackpotPoolsLoading, setJackpotPoolsLoading] = useState(false);
  const [jackpotWinnersRefreshToken, setJackpotWinnersRefreshToken] =
    useState(0);
  const [phase, setPhaseState] = useState<GamePhase>("disconnected");
  const setPhase = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  /** True after WS connect + auth; GameScreen is shown. */
  const [gameScreenActive, setGameScreenActive] = useState(false);
  /** True after join (cmd 1005) succeeded; spin and queries allowed. */
  const [sessionReady, setSessionReady] = useState(false);
  const joinInFlightRef = useRef(false);
  const [joinRetryOpen, setJoinRetryOpen] = useState(false);
  const [joinRetryMessage, setJoinRetryMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(
    null,
  );
  const [accessToken, setAccessToken] = useState("");
  const [agencyUserToken, setAgencyUserToken] = useState(
    () => loadAgencyUserToken() ?? "",
  );
  const [depositBusy, setDepositBusy] = useState(false);
  const [gameRoute, setGameRoute] = useState("");
  const [bet, setBet] = useState("1");
  const [betLevels, setBetLevels] = useState<string[]>([]);
  const [symbolCatalog, setSymbolCatalog] = useState<GameSymbol[]>([]);
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
  const [cheatInputRejectTick, setCheatInputRejectTick] = useState(0);


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

  const applyCheatGridFromReels = useCallback((reels: string[][]) => {
    const grid = cheatGridFromSpinReels(reels);
    setCheatGrid(grid);
    cheatBaselineRef.current = cloneCheatGrid(grid);
    setCheatGridDirty(false);
  }, []);

  const detachStompListener = useCallback(() => {
    stompListenerCleanupRef.current?.();
    stompListenerCleanupRef.current = null;
  }, []);

  const detachDisconnectListener = useCallback(() => {
    disconnectListenerCleanupRef.current?.();
    disconnectListenerCleanupRef.current = null;
  }, []);

  const endSession = useCallback(
    (options?: { error?: string | null }) => {
      if (sessionEndingRef.current) {
        return;
      }
      sessionEndingRef.current = true;
      detachDisconnectListener();
      detachStompListener();
      stopHeartbeat();
      stopSessionRefresh();
      clientRef.current?.close();
      clientRef.current = null;
      setError(options?.error === undefined ? null : options.error);
      setLastSpin(null);
      setGameScreenActive(false);
      setSessionReady(false);
      setCheatArmed(false);
      setForceJackpotArmed(false);
      setCheatGrid(emptyCheatGrid());
      cheatBaselineRef.current = emptyCheatGrid();
      setCheatGridDirty(false);
      setLastRound(null);
      setJackpotPoolsByTier({});
      setJackpotPoolsLoading(false);
      setJackpotWinnersRefreshToken(0);
      setBetLevels([]);
      setSymbolCatalog([]);
      setBalance(null);
      spinBusyRef.current = false;
      setSpinFreeze(null);
      joinInFlightRef.current = false;
      setJoinRetryOpen(false);
      setJoinRetryMessage(null);
      setPhase("disconnected");
      sessionEndingRef.current = false;
    },
    [
      detachDisconnectListener,
      detachStompListener,
      stopHeartbeat,
      stopSessionRefresh,
      setPhase,
    ],
  );

  const disconnect = useCallback(() => {
    endSession({ error: null });
  }, [endSession]);

  const handleTokenBan = useCallback(() => {
    clearGameSession();
    setAccessToken("");
    setAgencyUserToken("");
    endSession({
      error: "Game session token has been banned. Log in again.",
    });
  }, [endSession]);

  const logout = useCallback(() => {
    clearGameSession();
    setAccessToken("");
    setAgencyUserToken("");
    disconnect();
  }, [disconnect]);

  const connectionLostLogout = useCallback(
    (message: string) => {
      if (phaseRef.current === "disconnected" && clientRef.current === null) {
        return;
      }
      clearGameSession();
      setAccessToken("");
      setAgencyUserToken("");
      endSession({ error: message });
    },
    [endSession],
  );

  const handleJoinFailure = useCallback(
    (message: string) => {
      setPhase("connected");
      setJoinRetryMessage(message);
      setJoinRetryOpen(true);
    },
    [setPhase],
  );

  const dismissJoinRetry = useCallback(() => {
    setJoinRetryOpen(false);
    setJoinRetryMessage(null);
    logout();
  }, [logout]);

  const reauthWsWithToken = useCallback(
    (client: BrowserWsClient, wsAccessToken: string) => {
      client.sendFrame(
        connectFrame(agentIdRef.current.trim(), wsAccessToken.trim(), true),
      );
    },
    [],
  );

  const refreshBalance = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.isConnected() || !sessionReadyRef.current) {
      return;
    }
    try {
      const payloadPromise = client.waitForPayload(
        isGetBalanceResponsePayload,
        "balance query",
        { rejectMatcher: isGetBalanceErrorPayload },
      );
      client.sendFrame(getBalanceFrame(gameRoute.trim()));
      const payload = await payloadPromise;
      const parsed = parseGetBalancePayload(payload);
      if (parsed) {
        setBalance(parsed.balance);
      }
    } catch {
      // Silent refresh; last join/spin balance remains on screen.
    }
  }, [gameRoute]);

  const performWsSessionRefresh = useCallback(
    async (client: BrowserWsClient) => {
      if (sessionRefreshInFlightRef.current) {
        return;
      }
      sessionRefreshInFlightRef.current = true;
      try {
        if (clientRef.current !== client) {
          return;
        }
        if (!client.isConnected()) {
          connectionLostLogout("Connection lost (refresh: socket not open)");
          return;
        }
        const storedRefresh = loadRefreshToken();
        if (!storedRefresh) {
          connectionLostLogout("Session refresh token missing");
          return;
        }
        const { accessToken, refreshToken } =
          await refreshSessionToken(storedRefresh);
        saveRefreshToken(refreshToken);
        setAccessToken(accessToken);
        reauthWsWithToken(client, accessToken);
        if (sessionReadyRef.current) {
          void refreshBalance();
        }
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        connectionLostLogout(`Session refresh failed: ${detail}`);
      } finally {
        sessionRefreshInFlightRef.current = false;
      }
    },
    [connectionLostLogout, reauthWsWithToken, refreshBalance],
  );

  const startSessionRefresh = useCallback(
    (client: BrowserWsClient) => {
      stopSessionRefresh();
      sessionRefreshTimerRef.current = window.setInterval(() => {
        void performWsSessionRefresh(client);
      }, getWsSessionRefreshIntervalMs());
    },
    [performWsSessionRefresh, stopSessionRefresh],
  );

  const startHeartbeat = useCallback(
    (client: BrowserWsClient) => {
      stopHeartbeat();
      heartbeatCounterRef.current = 1;
      heartbeatTimerRef.current = window.setInterval(() => {
        if (clientRef.current !== client) {
          stopHeartbeat();
          return;
        }
        if (!client.isConnected()) {
          stopHeartbeat();
          connectionLostLogout("Connection lost (heartbeat: socket not open)");
          return;
        }
        try {
          client.sendFrame(heartbeatFrame(heartbeatCounterRef.current));
          heartbeatCounterRef.current += 1;
        } catch (e) {
          stopHeartbeat();
          const detail = e instanceof Error ? e.message : String(e);
          connectionLostLogout(
            `Connection lost (heartbeat failed: ${detail})`,
          );
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    [connectionLostLogout, stopHeartbeat],
  );

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

  const connectToGame = useCallback(async (wsAccessToken: string) => {
    const gameToken = wsAccessToken.trim();
    setError(null);
    setLastSpin(null);
    setLastRound(null);
    setBalance(null);
    setCheatGrid(emptyCheatGrid());
    setCheatArmed(false);
    setForceJackpotArmed(false);
    const wsUrl = wsUrlRef.current.trim();
    const agentId = agentIdRef.current.trim();
    if (!wsUrl) {
      setError("WebSocket URL is required");
      return;
    }
    if (!gameToken) {
      setError("Access token is required");
      return;
    }

    setAccessToken(gameToken);
    sessionEndingRef.current = false;
    disconnect();
    setPhase("connecting");

    const timeoutMs = defaults.timeoutMs;
    const client = new BrowserWsClient(wsUrl, { timeoutMs });
    clientRef.current = client;

    try {
      await client.connect();
      if (clientRef.current !== client) {
        return;
      }

      detachStompListener();
      detachDisconnectListener();
      stompListenerCleanupRef.current = client.addStompErrorListener((code) => {
        if (isTokenBannedStompError(code)) {
          handleTokenBan();
        }
      });
      disconnectListenerCleanupRef.current = client.addDisconnectListener(
        (info) => {
          connectionLostLogout(
            `Connection lost (code=${info.code}, reason=${info.reason})`,
          );
        },
      );

      const connect = connectFrame(agentId, gameToken, false);
      client.sendFrame(connect);
      // Allow server time to reject the CONNECT frame before showing UI.
      await delay(500);
      if (!client.isConnected()) {
        throw new Error("Connection rejected by server");
      }
      setPhase("connected");
      startHeartbeat(client);
      startSessionRefresh(client);
      setGameScreenActive(true);
    } catch (e) {
      if (clientRef.current !== client) {
        return;
      }
      if (e instanceof StompTokenBannedError) {
        handleTokenBan();
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      connectionLostLogout(message);
    }
  }, [
    defaults.timeoutMs,
    detachDisconnectListener,
    detachStompListener,
    disconnect,
    connectionLostLogout,
    handleTokenBan,
    startHeartbeat,
    startSessionRefresh,
    setPhase,
  ]);

  const joinGame = useCallback(async () => {
    if (sessionReady || joinInFlightRef.current) {
      return;
    }
    const client = clientRef.current;
    // Retry a few times — WS may still be stabilizing after CONNECT.
    for (let attempt = 0; attempt < 5; attempt++) {
      if (client?.isConnected()) {
        break;
      }
      if (attempt < 4) {
        await delay(200);
      }
    }
    if (!client?.isConnected()) {
      setError("WebSocket is not connected");
      return;
    }

    joinInFlightRef.current = true;
    setError(null);
    setPhase("joining");

    try {
      await delay(POST_AUTH_BEFORE_JOIN_MS);
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
      client.sendFrame(joinFrame(gameRoute.trim()));

      const rawJoinPayload = await joinPayloadPromise;
      const joinPayload = parseJoinResponsePayload(rawJoinPayload);

      if (clientRef.current !== client) {
        return;
      }
      if (!client.isConnected()) {
        const closeInfo = client.getLastCloseInfo();
        const detail = closeInfo
          ? `code=${closeInfo.code} reason=${closeInfo.reason}`
          : "socket not open";
        throw new Error(`Disconnected after join (${detail})`);
      }

      setSymbolCatalog(joinPayload.symbols);

      const joinBalance =
        joinPayload.balance ?? readTopLevelBalance(rawJoinPayload);
      if (joinBalance) {
        setBalance(joinBalance);
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

      applyJackpotPoolsFromPayload(rawJoinPayload);

      setJoinRetryOpen(false);
      setJoinRetryMessage(null);
      setSessionReady(true);
      setPhase("joined");
      void fetchJackpotPools();
    } catch (e) {
      if (e instanceof StompTokenBannedError) {
        handleTokenBan();
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      if (!clientRef.current?.isConnected()) {
        connectionLostLogout(message);
        return;
      }
      handleJoinFailure(message);
    } finally {
      joinInFlightRef.current = false;
    }
  }, [
    sessionReady,
    gameRoute,
    applyJackpotPoolsFromPayload,
    applyCheatGridFromReels,
    bet,
    fetchJackpotPools,
    handleTokenBan,
    connectionLostLogout,
    handleJoinFailure,
    setPhase,
  ]);

  const retryJoinGame = useCallback(() => {
    void joinGame();
  }, [joinGame]);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const trimmedUsername = username.trim();
      if (!trimmedUsername || !password) {
        setError("Username and password are required");
        return false;
      }

      setError(null);
      setAuthSuccessMessage(null);
      setPhase("logging-in");

      try {
        const { token: userToken } = await loginAgency({
          username: trimmedUsername,
          password,
        });
        saveAgencyUserToken(userToken);
        setAgencyUserToken(userToken);
        setPhase("disconnected");
        return true;
      } catch (e) {
        if (e instanceof StompTokenBannedError) {
          return false;
        }
        clearGameSession();
        setAccessToken("");
        setAgencyUserToken("");
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setPhase("disconnected");
        return false;
      }
    },
    [setPhase],
  );

  const launchGame = useCallback(async (game: GameDef): Promise<boolean> => {
    const userToken = agencyUserToken.trim();
    if (!userToken) {
      setError("Not logged in. Please sign in first.");
      return false;
    }

    // Set game config refs before connecting.
    gameIdRef.current = game.id;
    agentIdRef.current = game.agentId;
    jackpotTierInfoRef.current = game.jackpotTiers;

    setError(null);
    setPhase("launching");

    try {
      const { token, refreshToken } = await playGame(userToken, game.id);
      saveRefreshToken(refreshToken);
      saveLaunchedGameId(game.id);
      setGameRoute(game.id);
      await connectToGame(token);
      return true;
    } catch (e) {
      if (e instanceof StompTokenBannedError) {
        return false;
      }
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setPhase("disconnected");
      return false;
    }
  }, [agencyUserToken, connectToGame, setPhase]);

  const registerAccount = useCallback(
    async (
      username: string,
      password: string,
      displayName: string,
    ): Promise<boolean> => {
      const trimmedUsername = username.trim();
      const trimmedDisplayName = displayName.trim();
      if (!trimmedUsername || !password || !trimmedDisplayName) {
        setError("Username, password, and display name are required");
        return false;
      }

      setError(null);
      setAuthSuccessMessage(null);
      setPhase("registering");

      try {
        await register({
          username: trimmedUsername,
          password,
          displayName: trimmedDisplayName,
        });
        setAuthSuccessMessage(
          "Account created successfully. Sign in to play.",
        );
        setPhase("disconnected");
        return true;
      } catch (e) {
        if (e instanceof StompTokenBannedError) {
          return false;
        }
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setPhase("disconnected");
        return false;
      }
    },
    [setPhase],
  );

  const resumeFromRefreshToken = useCallback(async () => {
    const refreshToken = loadRefreshToken();
    const savedGameId = loadLaunchedGameId();
    if (!refreshToken || !savedGameId) {
      return;
    }
    const game = getGames().find((g) => g.id === savedGameId);
    if (!game) {
      return;
    }

    // Set game config refs.
    gameIdRef.current = game.id;
    agentIdRef.current = game.agentId;
    jackpotTierInfoRef.current = game.jackpotTiers;

    setError(null);
    setPhase("refreshing");
    try {
      const { accessToken, refreshToken: nextRefresh } =
        await refreshSessionToken(refreshToken);
      saveRefreshToken(nextRefresh);
      setGameRoute(game.id);
      await connectToGame(accessToken);
    } catch (e) {
      if (e instanceof StompTokenBannedError) {
        return;
      }
      clearGameSession();
      setAccessToken("");
      setAgencyUserToken("");
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setPhase("disconnected");
    }
  }, [connectToGame, setPhase]);

  const depositFunds = useCallback(async () => {
    const userToken = agencyUserToken.trim();
    const currentBalance = parseBalanceAmount(balance);
    if (
      !userToken ||
      currentBalance == null ||
      currentBalance >= DEPOSIT_BALANCE_CAP ||
      depositBusy
    ) {
      return;
    }

    setDepositBusy(true);
    setError(null);
    try {
      await deposit(userToken, { amount: String(DEPOSIT_AMOUNT) });
      await refreshBalance();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setDepositBusy(false);
    }
  }, [agencyUserToken, balance, depositBusy, refreshBalance]);

  useEffect(() => {
    sessionReadyRef.current = sessionReady;
  }, [sessionReady]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshBalance();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshBalance]);

  useEffect(() => {
    if (autoConnectStartedRef.current || gameScreenActive) {
      return;
    }
    if (!loadRefreshToken() || !loadLaunchedGameId()) {
      return;
    }
    autoConnectStartedRef.current = true;
    queueMicrotask(() => {
      void resumeFromRefreshToken();
    });
  }, [resumeFromRefreshToken, gameScreenActive]);

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
      stopSessionRefresh();
    },
    [stopHeartbeat, stopSessionRefresh],
  );

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

  const lockedRoundBet = useMemo(() => {
    if (!betLocked || !displaySpin?.round) {
      return null;
    }
    return readRoundBetString(displaySpin.round as { bet: unknown });
  }, [betLocked, displaySpin]);

  const activeBet = useMemo(() => {
    if (lockedRoundBet) {
      return resolveBetFromLevels(betLevels, lockedRoundBet);
    }
    return bet;
  }, [lockedRoundBet, betLevels, bet]);

  const spin = useCallback(async (): Promise<SpinResponsePayload | null> => {
    const client = clientRef.current;
    if (
      !client?.isConnected() ||
      phase !== "joined" ||
      !sessionReady ||
      spinBusyRef.current
    ) {
      return null;
    }
    setError(null);
    spinBusyRef.current = true;
    setSpinFreeze(lastSpin ?? lastRound);
    setPhase("spinning");
    try {
      const payloadPromise = client.waitForPayload(
        isSpinResponsePayload,
        "spin response",
        { rejectMatcher: isSpinErrorPayload },
      );
      const frame = spinFrame(gameRoute.trim(), String(activeBet));
      client.sendFrame(frame);
      const payload = await payloadPromise;
      const spinPayload = payload as unknown as SpinResponsePayload;
      const spinBalance = readTopLevelBalance(payload);
      if (spinBalance) {
        setBalance(spinBalance);
      }
      setLastSpin(spinPayload);
      setLastRound(null);
      applyCheatGridFromReels(spinPayload.spin.reels);

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
      return spinPayload;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!client.isConnected() || isWsConnectionLostMessage(message)) {
        connectionLostLogout(message);
      } else {
        setError(formatSpinErrorForUi(message));
        setPhase("joined");
      }
      return null;
    } finally {
      spinBusyRef.current = false;
      setSpinFreeze(null);
    }
  }, [
    lastSpin,
    lastRound,
    activeBet,
    applyCheatGridFromReels,
    cheatArmed,
    forceJackpotArmed,
    gameRoute,
    phase,
    applyJackpotPools,
    fetchJackpotPools,
    sessionReady,
    connectionLostLogout,
    setPhase,
  ]);

  const discardCheatGrid = useCallback(() => {
    setCheatGrid(cloneCheatGrid(cheatBaselineRef.current));
    setCheatGridDirty(false);
  }, []);

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
      client.sendFrame(
        historyListFrame(gameRoute.trim(), page, HISTORY_LIST_DEFAULT_SIZE),
      );
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
      if (!isAllowedCheatSymbolInput(value)) {
        setCheatInputRejectTick((tick) => tick + 1);
        return;
      }
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
    betLevels.includes(activeBet);
  const canCheat = phase === "joined" && sessionReady;
  const busyRegister = phase === "registering";
  const balanceAmount = parseBalanceAmount(balance);
  const canDeposit =
    sessionReady &&
    agencyUserToken.trim() !== "" &&
    !depositBusy &&
    balanceAmount != null &&
    balanceAmount < DEPOSIT_BALANCE_CAP;
  const busySession =
    phase === "logging-in" ||
    phase === "launching" ||
    phase === "refreshing" ||
    phase === "connecting" ||
    phase === "connected";

  const selectBetValue =
    betLevels.length > 0 && betLevels.includes(activeBet)
      ? activeBet
      : (betLevels[0] ?? "");

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
    jackpotPoolsByTier,
    jackpotTierInfo: jackpotTierInfoRef.current,
    jackpotPoolsLoading,
    jackpotWinnersRefreshToken,
    phase,
    gameScreenActive,
    sessionReady,
    joinGame,
    joinRetryOpen,
    joinRetryMessage,
    joinRetryBusy: phase === "joining",
    retryJoinGame,
    dismissJoinRetry,
    error,
    setError,
    accessToken,
    agencyUserToken,
    bet,
    setBet,
    betLevels,
    symbolCatalog,
    balance,
    canDeposit,
    depositBusy,
    depositFunds,
    cheatGrid,
    login,
    launchGame,
    registerAccount,
    authSuccessMessage,
    setAuthSuccessMessage,
    busyRegister,
    logout,
    disconnect,
    spin,
    sendCheat,
    discardCheatGrid,
    cheatArmed,
    sendForceJackpot,
    forceJackpotBusy,
    fetchHistoryList,
    fetchHistoryDetail,
    fetchJackpotWinHistory,
    updateCheatCell,
    canSpin,
    canCheat,
    busySession,
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
    cheatInputRejectTick,
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
