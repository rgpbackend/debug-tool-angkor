import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWsSessionRefreshIntervalMs } from "../lib/ws-session-refresh";
import { refreshSessionToken } from "../api/auth";
import {
  clearGameSession,
  loadRefreshToken,
  saveRefreshToken,
} from "../lib/game-session-storage";
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
import {
  connectFrame,
  joinFrame,
  heartbeatFrame,
  jackpotPoolsFrame,
  getBalanceFrame,
} from "./frames";
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
  type ServerPayline,
} from "./protocol";
import { isTokenBannedStompError } from "./stomp-errors";
import type { GamePhase } from "./game-phase";

const POST_AUTH_BEFORE_JOIN_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;

export interface WsSessionCallbacks {
  onTokenBan: () => void;
  onConnectionLost: (message: string) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useWsSession(
  wsUrl: string,
  gameId: string,
  agentId: string,
  jackpotTierInfo: readonly JackpotTierInfo[],
  wsAccessToken: string,
  callbacks: WsSessionCallbacks,
) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

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
  const autoConnectStartedRef = useRef(false);
  const gameRouteRef = useRef(gameId.trim());
  const jackpotTierInfoRef = useRef(jackpotTierInfo);

  const [phase, setPhaseState] = useState<GamePhase>("disconnected");
  const setPhase = useCallback((next: GamePhase) => {
    setPhaseState(next);
  }, []);
  const [gameScreenActive, setGameScreenActive] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [symbolCatalog, setSymbolCatalog] = useState<GameSymbol[]>([]);
  const [betLevels, setBetLevels] = useState<string[]>([]);
  const [serverPaylines, setServerPaylines] = useState<ServerPayline[]>([]);
  const [lastRound, setLastRound] = useState<LastRound | null>(null);
  const [jackpotPoolsByTier, setJackpotPoolsByTier] =
    useState<JackpotPoolsByTier>(() =>
      emptyJackpotPoolsByTier(jackpotTierInfo),
    );
  const [jackpotPoolsLoading, setJackpotPoolsLoading] = useState(false);
  const [jackpotWinnersRefreshToken, setJackpotWinnersRefreshToken] =
    useState(0);
  const [joinRetryOpen, setJoinRetryOpen] = useState(false);
  const [joinRetryMessage, setJoinRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    sessionReadyRef.current = sessionReady;
  }, [sessionReady]);

  // --- cleanup helpers ---

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

  // --- jackpot pools ---

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

  // --- balance ---

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
      client.sendFrame(getBalanceFrame(gameRouteRef.current));
      const payload = await payloadPromise;
      const parsed = parseGetBalancePayload(payload);
      if (parsed) {
        setBalance(parsed.balance);
      }
    } catch {
      // Silent refresh; last join/spin balance remains on screen.
    }
  }, []);

  const fetchJackpotPools = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.isConnected()) {
      return;
    }
    setJackpotPoolsLoading(true);
    try {
      const payloadPromise = client.waitForPayload(
        isJackpotPoolsPayload,
        "jackpot pools",
      );
      client.sendFrame(jackpotPoolsFrame(gameRouteRef.current));
      const payload = await payloadPromise;
      const poolsPayload = payload as unknown as JackpotPoolsPayload;
      applyJackpotPools(poolsPayload.pools);
    } catch {
      // Best-effort; UI still works via push 1520.
    } finally {
      setJackpotPoolsLoading(false);
    }
  }, [applyJackpotPools]);

  // --- session refresh ---

  const reauthWsWithToken = useCallback(
    (client: BrowserWsClient, token: string) => {
      client.sendFrame(
        connectFrame(agentId.trim(), token.trim(), true),
      );
    },
    [agentId],
  );

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
          callbacksRef.current.onConnectionLost(
            "Connection lost (refresh: socket not open)",
          );
          return;
        }
        const storedRefresh = loadRefreshToken();
        if (!storedRefresh) {
          callbacksRef.current.onConnectionLost(
            "Session refresh token missing",
          );
          return;
        }
        const { accessToken, refreshToken: nextRefresh } =
          await refreshSessionToken(storedRefresh);
        saveRefreshToken(nextRefresh);
        reauthWsWithToken(client, accessToken);
        if (sessionReadyRef.current) {
          void refreshBalance();
        }
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        callbacksRef.current.onConnectionLost(
          `Session refresh failed: ${detail}`,
        );
      } finally {
        sessionRefreshInFlightRef.current = false;
      }
    },
    [reauthWsWithToken, refreshBalance],
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

  // --- heartbeat ---

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
          callbacksRef.current.onConnectionLost(
            "Connection lost (heartbeat: socket not open)",
          );
          return;
        }
        try {
          client.sendFrame(heartbeatFrame(heartbeatCounterRef.current));
          heartbeatCounterRef.current += 1;
        } catch (e) {
          stopHeartbeat();
          const detail = e instanceof Error ? e.message : String(e);
          callbacksRef.current.onConnectionLost(
            `Connection lost (heartbeat failed: ${detail})`,
          );
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    [stopHeartbeat],
  );

  // --- end session ---

  const endSession = useCallback(
    (opts?: { error?: string | null }) => {
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
      setError(opts?.error === undefined ? null : opts.error);
      setGameScreenActive(false);
      setSessionReady(false);
      setLastRound(null);
      setJackpotPoolsByTier(
        emptyJackpotPoolsByTier(jackpotTierInfoRef.current),
      );
      setJackpotPoolsLoading(false);
      setJackpotWinnersRefreshToken(0);
      setBetLevels([]);
      setServerPaylines([]);
      setSymbolCatalog([]);
      setBalance(null);
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

  const disconnect = useCallback(
    () => endSession({ error: null }),
    [endSession],
  );

  // --- join failure ---

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
    clearGameSession();
    callbacksRef.current.onConnectionLost("Join cancelled");
  }, []);

  // --- connect ---

  const connectToGame = useCallback(
    async (token: string) => {
      const gameToken = token.trim();
      setError(null);
      setLastRound(null);
      setBalance(null);
      const url = wsUrl.trim();
      const aid = agentId.trim();
      if (!url) {
        setError("WebSocket URL is required");
        return;
      }
      if (!gameToken) {
        setError("Access token is required");
        return;
      }

      sessionEndingRef.current = false;
      disconnect();
      setPhase("connecting");

      const client = new BrowserWsClient(url, { timeoutMs });
      clientRef.current = client;

      try {
        await client.connect();
        if (clientRef.current !== client) {
          return;
        }

        detachStompListener();
        detachDisconnectListener();
        stompListenerCleanupRef.current = client.addStompErrorListener(
          (code) => {
            if (isTokenBannedStompError(code)) {
              callbacksRef.current.onTokenBan();
            }
          },
        );
        disconnectListenerCleanupRef.current = client.addDisconnectListener(
          (info) => {
            callbacksRef.current.onConnectionLost(
              `Connection lost (code=${info.code}, reason=${info.reason})`,
            );
          },
        );

        client.sendFrame(connectFrame(aid, gameToken, false));
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
          callbacksRef.current.onTokenBan();
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        callbacksRef.current.onConnectionLost(message);
      }
    },
    [
      wsUrl,
      agentId,
      timeoutMs,
      detachDisconnectListener,
      detachStompListener,
      disconnect,
      startHeartbeat,
      startSessionRefresh,
      setPhase,
    ],
  );

  // --- join ---

  const joinGame = useCallback(async () => {
    if (sessionReadyRef.current || joinInFlightRef.current) {
      return;
    }
    const client = clientRef.current;
    // Retry a few times — WS may still be stabilizing after CONNECT.
    for (let attempt = 0; attempt < 10; attempt++) {
      if (client?.isConnected()) {
        break;
      }
      if (attempt < 9) {
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
      client.sendFrame(joinFrame(gameRouteRef.current));

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

      // Store server-provided paylines (Titan's Wrath, etc.)
      if (joinPayload.paylines?.length) {
        setServerPaylines(joinPayload.paylines);
      }

      const joinBalance =
        joinPayload.balance ?? readTopLevelBalance(rawJoinPayload);
      if (joinBalance) {
        setBalance(joinBalance);
      }

      if (joinPayload.lastRound) {
        setLastRound(joinPayload.lastRound);
      }

      const levels = Array.isArray(joinPayload.betLevels)
        ? joinPayload.betLevels.filter(
            (level): level is string => typeof level === "string",
          )
        : [];
      setBetLevels(levels);

      applyJackpotPoolsFromPayload(rawJoinPayload);

      setJoinRetryOpen(false);
      setJoinRetryMessage(null);
      setSessionReady(true);
      setPhase("joined");
      void fetchJackpotPools();
    } catch (e) {
      if (e instanceof StompTokenBannedError) {
        callbacksRef.current.onTokenBan();
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      if (!clientRef.current?.isConnected()) {
        callbacksRef.current.onConnectionLost(message);
        return;
      }
      handleJoinFailure(message);
    } finally {
      joinInFlightRef.current = false;
    }
  }, [
    applyJackpotPoolsFromPayload,
    fetchJackpotPools,
    handleJoinFailure,
    setPhase,
  ]);

  // Make retryJoinGame actually call joinGame
  const retryJoinGameFinal = useCallback(() => {
    void joinGame();
  }, [joinGame]);

  // --- auto-connect on mount ---

  useEffect(() => {
    if (!wsAccessToken.trim() || autoConnectStartedRef.current) {
      return;
    }
    autoConnectStartedRef.current = true;
    queueMicrotask(() => {
      void connectToGame(wsAccessToken);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- jackpot push listeners ---

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

  // --- visibility change → refresh balance ---

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshBalance();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshBalance]);

  // --- cleanup on unmount ---

  useEffect(
    () => () => {
      stopHeartbeat();
      stopSessionRefresh();
    },
    [stopHeartbeat, stopSessionRefresh],
  );

  return {
    phase,
    sessionReady,
    gameScreenActive,
    error,
    balance,
    setBalance,
    symbolCatalog,
    betLevels,
    serverPaylines,
    lastRound,
    jackpotPoolsByTier,
    jackpotPoolsLoading,
    jackpotWinnersRefreshToken,
    gameRoute: gameRouteRef.current,
    clientRef,
    joinGame,
    joinRetryOpen,
    joinRetryMessage,
    joinRetryBusy: phase === "joining",
    retryJoinGame: retryJoinGameFinal,
    dismissJoinRetry,
    disconnect,
    refreshBalance,
    fetchJackpotPools,
    applyJackpotPools,
    applyJackpotPoolsFromPayload,
  };
}
