import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readEnvDefaults } from "./config";
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
} from "./ws/browser-ws-client";
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
} from "./ws/frames";
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
  type WinWay,
} from "./ws/protocol";
import type { GamePhase } from "./ws/game-phase";
import HistoryView from "./components/HistoryView";
import JackpotPoolsBar from "./components/JackpotPoolsBar";
import JackpotWinnersView from "./components/JackpotWinnersView";
import "./App.css";

const LOG_CAP = 100;
const HEARTBEAT_INTERVAL_MS = 30_000;
/** Delay after auth connect frame, before join (cmd 1005). */
const POST_AUTH_BEFORE_JOIN_MS = 1000;
const EXPECTED_CHEAT_REEL_SIZES = [3, 4, 4, 4, 3] as const;
const VALID_CHEAT_SYMBOLS = new Set([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "GW",
  "H",
  "I",
  "W",
  "S",
]);

const CHEAT_SYMBOL_OPTIONS = [...VALID_CHEAT_SYMBOLS].sort((a, b) =>
  a.localeCompare(b),
);

function emptyCheatGrid(): string[][] {
  return EXPECTED_CHEAT_REEL_SIZES.map((len) =>
    Array.from({ length: len }, () => ""),
  );
}

/** Map spin response reels into cheat grid cells (pad/trim to [3,4,4,4,3]). */
function cheatGridFromSpinReels(reels: string[][]): string[][] {
  return EXPECTED_CHEAT_REEL_SIZES.map((expectedLen, ci) => {
    const col = reels[ci] ?? [];
    return Array.from({ length: expectedLen }, (_, ri) => {
      const raw = col[ri];
      if (typeof raw !== "string") {
        return "";
      }
      return raw.trim().toUpperCase();
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function readRoundBetString(round: { bet: unknown }): string | null {
  if (typeof round.bet === "string") {
    return round.bet;
  }
  if (typeof round.bet === "number" && Number.isFinite(round.bet)) {
    return round.bet.toFixed(4);
  }
  return null;
}

/** Pick a betLevels entry; matches exact wire string or numeric value. */
function resolveBetFromLevels(
  levels: readonly string[],
  preferred?: string,
): string {
  if (levels.length === 0) {
    return preferred ?? "1";
  }
  if (preferred && levels.includes(preferred)) {
    return preferred;
  }
  if (preferred) {
    const prefNum = Number(preferred);
    if (Number.isFinite(prefNum)) {
      const match = levels.find((level) => Number(level) === prefNum);
      if (match) {
        return match;
      }
    }
  }
  return levels[0];
}

function parseBetLevelsFromJoin(
  joinPayload: JoinResponsePayload,
): string[] {
  if (Array.isArray(joinPayload.betLevels)) {
    return joinPayload.betLevels.filter(
      (level): level is string => typeof level === "string",
    );
  }
  const raw = joinPayload as unknown as Record<string, unknown>;
  if (!Array.isArray(raw.betLevels)) {
    return [];
  }
  return raw.betLevels.filter(
    (level): level is string => typeof level === "string",
  );
}

function appendLogLine(
  prev: string[],
  direction: "in" | "out",
  summary: string,
): string[] {
  const ts = new Date().toISOString();
  const line = `${ts} ${direction === "out" ? "→" : "←"} ${summary}`;
  return [line, ...prev].slice(0, LOG_CAP);
}

/** Cheat cells are mostly one letter; `GW` is two letters (Golden Wild). */
function normalizeCheatSymbolInput(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (u === "GW" || u.endsWith("GW")) {
    return "GW";
  }
  return u.slice(-1);
}

function setCheatCellValue(
  prev: string[][],
  ci: number,
  ri: number,
  colLen: number,
  raw: string,
): string[][] {
  const v = normalizeCheatSymbolInput(raw);
  const next = prev.map((c) => [...c]);
  if ((next[ci]?.length ?? 0) !== colLen) {
    next[ci] = Array.from({ length: colLen }, (_, i) => next[ci]?.[i] ?? "");
  }
  next[ci][ri] = v;
  return next;
}

function validateCheatReels(reels: string[][]): {
  reels?: string[][];
  error?: string;
} {
  if (reels.length !== EXPECTED_CHEAT_REEL_SIZES.length) {
    return { error: "Cheat reels must contain exactly 5 columns." };
  }

  const normalized: string[][] = [];
  for (let ci = 0; ci < reels.length; ci += 1) {
    const expectedLen = EXPECTED_CHEAT_REEL_SIZES[ci];
    const col = reels[ci];
    if (col.length !== expectedLen) {
      return {
        error: `Reel ${ci + 1} must contain ${expectedLen} symbols.`,
      };
    }
    const symbols: string[] = [];
    for (let ri = 0; ri < col.length; ri += 1) {
      const raw = col[ri]?.trim() ?? "";
      if (!raw) {
        return {
          error: `Empty cell at reel ${ci + 1}, row ${ri + 1}.`,
        };
      }
      const symbol = raw.toUpperCase();
      if (!VALID_CHEAT_SYMBOLS.has(symbol)) {
        return {
          error: `Invalid symbol "${symbol}" at reel ${ci + 1}, row ${ri + 1}. Allowed: A-I, W, GW, S.`,
        };
      }
      symbols.push(symbol);
    }
    normalized.push(symbols);
  }
  return { reels: normalized };
}

function winWayHighlightKey(reelIndex: number, rowIndex: number): string {
  return `${reelIndex}:${rowIndex}`;
}

function buildWinWayHighlightSet(way: WinWay | undefined): Set<string> {
  const keys = new Set<string>();
  if (!way?.positions) {
    return keys;
  }
  way.positions.forEach((rows, reelIndex) => {
    if (!rows) {
      return;
    }
    rows.forEach((rowIndex) => {
      keys.add(winWayHighlightKey(reelIndex, rowIndex));
    });
  });
  return keys;
}

function buildGoldenWildHighlightSet(
  pairs: readonly [number, number][] | undefined,
): Set<string> {
  const keys = new Set<string>();
  if (!pairs?.length) {
    return keys;
  }
  for (const p of pairs) {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      typeof p[0] !== "number" ||
      typeof p[1] !== "number"
    ) {
      continue;
    }
    keys.add(winWayHighlightKey(p[0], p[1]));
  }
  return keys;
}

function readSpinJackpot(spin: SpinResponsePayload["spin"]): {
  triggered: boolean;
  tier: string | null;
  jackpotWin: number;
  goldenWildPositions: [number, number][];
} {
  const j = spin.jackpot as Record<string, unknown> | undefined;
  if (!j || typeof j !== "object") {
    return {
      triggered: false,
      tier: null,
      jackpotWin: 0,
      goldenWildPositions: [],
    };
  }
  const pairsRaw = j.goldenWildPositions;
  const goldenWildPositions: [number, number][] = [];
  if (Array.isArray(pairsRaw)) {
    for (const item of pairsRaw) {
      if (
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "number" &&
        typeof item[1] === "number"
      ) {
        goldenWildPositions.push([item[0], item[1]]);
      }
    }
  }
  return {
    triggered: Boolean(j.triggered),
    tier: typeof j.tier === "string" ? j.tier : null,
    jackpotWin: typeof j.jackpotWin === "number" ? j.jackpotWin : 0,
    goldenWildPositions,
  };
}

function readSpinRetrigger(spin: SpinResponsePayload["spin"]): {
  triggered: boolean;
  scatterCount: number;
  addedFreeSpins: number;
  scatterPositions: [number, number][];
} {
  const retrigger = spin.retrigger as Record<string, unknown> | undefined;
  if (!retrigger || typeof retrigger !== "object") {
    return {
      triggered: false,
      scatterCount: 0,
      addedFreeSpins: 0,
      scatterPositions: [],
    };
  }
  const positionsRaw = retrigger.scatterPositions;
  const scatterPositions: [number, number][] = [];
  if (Array.isArray(positionsRaw)) {
    for (const item of positionsRaw) {
      if (
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "number" &&
        typeof item[1] === "number"
      ) {
        scatterPositions.push([item[0], item[1]]);
      }
    }
  }
  return {
    triggered: Boolean(retrigger.triggered),
    scatterCount:
      typeof retrigger.scatterCount === "number" ? retrigger.scatterCount : 0,
    addedFreeSpins:
      typeof retrigger.addedFreeSpins === "number"
        ? retrigger.addedFreeSpins
        : 0,
    scatterPositions,
  };
}

interface CheatReelGridEditorProps {
  cheatGrid: string[][];
  canCheat: boolean;
  onCellChange: (
    reelIndex: number,
    rowIndex: number,
    colLen: number,
    value: string,
  ) => void;
}

function CheatReelGridEditor({
  cheatGrid,
  canCheat,
  onCellChange,
}: Readonly<CheatReelGridEditorProps>) {
  return (
    <div className="cheat-grid-wrap">
      <div className="cheat-grid" aria-label="Cheat reel grid">
        {EXPECTED_CHEAT_REEL_SIZES.map((size, ci) => (
          <div
            key={`cheat-reel-r${ci + 1}-cells-${size}`}
            className="cheat-col"
          >
            {Array.from({ length: size }, (_, ri) => (
              <input
                key={`cheat-reel-r${ci + 1}-slot-${ri + 1}`}
                className="cheat-cell-input"
                value={cheatGrid[ci]?.[ri] ?? ""}
                onChange={(e) => onCellChange(ci, ri, size, e.target.value)}
                maxLength={2}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                aria-label={`Reel ${ci + 1} row ${ri + 1}`}
                disabled={!canCheat}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const defaults = useMemo(() => readEnvDefaults(), []);
  const clientRef = useRef<BrowserWsClient | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);

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
  const [log, setLog] = useState<string[]>([]);

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
  const [highlightWinWayIndex, setHighlightWinWayIndex] = useState(0);
  const [cheatStatus, setCheatStatus] = useState<string | null>(null);
  const [cheatArmed, setCheatArmed] = useState(false);
  const [forceJackpotArmed, setForceJackpotArmed] = useState(false);

  const pushLog = useCallback((direction: "in" | "out", summary: string) => {
    setLog((prev) => appendLogLine(prev, direction, summary));
  }, []);

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
          pushLog("out", 'heartbeat ["7","MiniGame","1",2]');
        } catch {
          stopHeartbeat();
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    [pushLog, stopHeartbeat],
  );

  const disconnect = useCallback(() => {
    stopHeartbeat();
    clientRef.current?.close();
    clientRef.current = null;
    setSessionReady(false);
    setCheatArmed(false);
    setForceJackpotArmed(false);
    setCheatStatus(null);
    setCheatGrid(emptyCheatGrid());
    setHighlightWinWayIndex(0);
    setLastRound(null);
    setJackpotPoolsByTier(emptyJackpotPoolsByTier());
    setJackpotPoolsLoading(false);
    setJackpotWinnersRefreshToken(0);
    setBetLevels([]);
    setActiveTab("game");
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
    if (!client?.isConnected()) {
      return;
    }
    setJackpotPoolsLoading(true);
    try {
      const payloadPromise = client.waitForPayload(
        isJackpotPoolsPayload,
        "jackpot pools",
      );
      client.sendFrame(jackpotPoolsFrame(gameRoute.trim()));
      pushLog("out", "jackpot pools cmd=1510");
      const payload = await payloadPromise;
      pushLog("in", "jackpot pools cmd=1510 response");
      const poolsPayload = payload as unknown as JackpotPoolsPayload;
      applyJackpotPools(poolsPayload.pools);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      pushLog("in", `jackpot pools error: ${message}`);
    } finally {
      setJackpotPoolsLoading(false);
    }
  }, [applyJackpotPools, gameRoute, pushLog]);

  const connectAndJoin = useCallback(async () => {
    setError(null);
    setLastSpin(null);
    setLastRound(null);
    setHighlightWinWayIndex(0);
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
      pushLog("out", `connect MiniGame agentId=${agentId}`);
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
      pushLog("out", `join cmd=1005 route=${gameRoute}`);

      const joinPayload =
        (await joinPayloadPromise) as unknown as JoinResponsePayload;
      pushLog(
        "in",
        `join cmd=1005 c=${joinPayload.c} lastRound=${joinPayload.lastRound ? joinPayload.lastRound.round.state : "null"}`,
      );

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
    pushLog,
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
        pushLog("in", "jackpot pools push cmd=1520");
      },
    );

    const removeWinnerPush = client.addPayloadListener(
      isJackpotWinnerPush,
      (payload) => {
        pushLog(
          "in",
          `jackpot winner push cmd=1521 tier=${String(payload.tier)}`,
        );
        setJackpotWinnersRefreshToken((t) => t + 1);
      },
    );

    return () => {
      removePoolsPush();
      removeWinnerPush();
    };
  }, [applyJackpotPoolsFromPayload, pushLog, sessionReady]);

  useEffect(
    () => () => {
      stopHeartbeat();
    },
    [stopHeartbeat],
  );

  useEffect(() => {
    setHighlightWinWayIndex(0);
  }, [lastSpin?.spin.spinId]);

  const spin = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.isConnected() || phase !== "joined" || !sessionReady) {
      return;
    }
    setError(null);
    setPhase("spinning");
    try {
      const payloadPromise = client.waitForPayload(
        isSpinResponsePayload,
        "spin response",
      );
      const frame = spinFrame(gameRoute.trim(), String(bet));
      client.sendFrame(frame);
      pushLog("out", `spin cmd=1500 bet=${bet}`);
      const payload = await payloadPromise;
      pushLog("in", "spin cmd=1500 payload");
      const spinPayload = payload as unknown as SpinResponsePayload;
      setLastSpin(spinPayload);
      setLastRound(null);
      setCheatGrid(cheatGridFromSpinReels(spinPayload.spin.reels));

      const poolsFromSpin = parseJackpotPoolsFromPayload(payload);
      if (poolsFromSpin) {
        applyJackpotPools(poolsFromSpin);
        pushLog("in", "jackpot pools from spin cmd=1500");
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
    }
  }, [
    bet,
    cheatArmed,
    forceJackpotArmed,
    gameRoute,
    phase,
    applyJackpotPools,
    fetchJackpotPools,
    pushLog,
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
      pushLog("out", "cheat cmd=2001 reels=[3,4,4,4,3]");
      setCheatArmed(true);
      setCheatStatus("Cheat set for next spin.");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }, [cheatGrid, gameRoute, phase, pushLog, sessionReady]);

  const sendForceJackpot = useCallback(() => {
    const client = clientRef.current;
    if (!client?.isConnected() || phase !== "joined" || !sessionReady) {
      return;
    }

    setError(null);
    try {
      const frame = forceJackpotNextSpinFrame(gameRoute.trim());
      client.sendFrame(frame);
      pushLog("out", "cheat cmd=2002 force-jackpot-next-spin");
      setForceJackpotArmed(true);
      setCheatStatus("Force jackpot set for next spin.");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }, [gameRoute, phase, pushLog, sessionReady]);

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
      pushLog("out", `history list cmd=1502 page=${page}`);
      const payload = await payloadPromise;
      pushLog("in", "history list cmd=1502 response");
      return payload as unknown as HistoryListPayload;
    },
    [gameRoute, pushLog],
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
      pushLog("out", "jackpot win history cmd=1511 limit=10");
      const payload = await payloadPromise;
      pushLog("in", "jackpot win history cmd=1511 response");
      return payload as unknown as JackpotWinHistoryPayload;
    }, [gameRoute, pushLog]);

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
      pushLog(
        "out",
        `history detail cmd=1503 roundId=${roundId} spinId=${spinId}`,
      );
      const payload = await payloadPromise;
      pushLog("in", "history detail cmd=1503 response");
      return payload as unknown as HistoryDetailPayload;
    },
    [gameRoute, pushLog],
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

  const winWays = displaySpin?.spin?.winWays ?? [];
  const safeHighlightIndex =
    winWays.length === 0
      ? 0
      : Math.min(Math.max(highlightWinWayIndex, 0), winWays.length - 1);
  const highlightedWinWay = winWays[safeHighlightIndex];
  const winWayHighlightKeys = useMemo(
    () => buildWinWayHighlightSet(highlightedWinWay),
    [highlightedWinWay],
  );

  const jackpotInfo = useMemo(
    () => (displaySpin?.spin ? readSpinJackpot(displaySpin.spin) : null),
    [displaySpin],
  );
  const retriggerInfo = useMemo(
    () => (displaySpin?.spin ? readSpinRetrigger(displaySpin.spin) : null),
    [displaySpin],
  );
  const goldenWildHighlightKeys = useMemo(
    () => buildGoldenWildHighlightSet(jackpotInfo?.goldenWildPositions),
    [jackpotInfo],
  );

  return (
    <div className="game-app">
      <header className="game-header">
        <h1>The Last Guardian of Angkor</h1>
        <p className="game-sub">WebSocket test client</p>
      </header>

      <div className="tab-bar">
        <button
          type="button"
          className={`tab${activeTab === "game" ? " tab-active" : ""}`}
          onClick={() => setActiveTab("game")}
        >
          Game
        </button>
        <button
          type="button"
          className={`tab${activeTab === "history" ? " tab-active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
        <button
          type="button"
          className={`tab${activeTab === "jackpots" ? " tab-active" : ""}`}
          onClick={() => setActiveTab("jackpots")}
        >
          Jackpot
        </button>
      </div>

      {activeTab === "history" ? (
        <HistoryView
          canQuery={sessionReady && phase !== "spinning"}
          onFetchList={fetchHistoryList}
          onFetchDetail={fetchHistoryDetail}
        />
      ) : activeTab === "jackpots" ? (
        <JackpotWinnersView
          canQuery={sessionReady && phase !== "spinning"}
          onFetch={fetchJackpotWinHistory}
          refreshToken={jackpotWinnersRefreshToken}
        />
      ) : (
        <div className="main-grid two-pane">
          <section className="panel action-pane">
            <h2>Actions</h2>

            <div className="action-group">
              <h3>Connection</h3>
              <div className="field-grid">
                <label>
                  WS URL
                  <input
                    value={wsUrl}
                    onChange={(e) => setWsUrl(e.target.value)}
                    placeholder="wss://…/websocket"
                    autoComplete="off"
                    disabled={busyConnect || phase === "spinning"}
                  />
                </label>
                <label>
                  Agent ID
                  <input
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    disabled={busyConnect || phase === "spinning"}
                  />
                </label>
                <label className="span-2">
                  Access token
                  <input
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    type="text"
                    autoComplete="off"
                    disabled={busyConnect || phase === "spinning"}
                  />
                </label>
                <label className="span-2">
                  Game route
                  <input
                    value={gameRoute}
                    onChange={(e) => setGameRoute(e.target.value)}
                    disabled={busyConnect || phase === "spinning"}
                  />
                </label>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  onClick={() => void connectAndJoin()}
                  disabled={busyConnect || phase === "spinning"}
                >
                  {busyConnect ? "Connecting…" : "Connect + join"}
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={phase === "disconnected"}
                >
                  Disconnect
                </button>
              </div>
            </div>

            <div className="action-group">
              <h3>Spin</h3>
              <div className="field-grid">
                <label>
                  Bet
                  <select
                    value={selectBetValue}
                    onChange={(e) => setBet(e.target.value)}
                    disabled={
                      phase === "spinning" ||
                      !sessionReady ||
                      betLocked ||
                      betLevels.length === 0
                    }
                  >
                    {betLevels.length === 0 ? (
                      <option value="">Connect + join to load bets</option>
                    ) : (
                      betLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  onClick={() => void spin()}
                  disabled={!canSpin}
                >
                  Spin
                </button>
              </div>
            </div>

            <div className="action-group">
              <h3>Cheat</h3>
              <p className="cheat-hint muted">
                Shape <code>[3,4,4,4,3]</code> — one symbol per cell (
                {CHEAT_SYMBOL_OPTIONS.join(", ")}).
              </p>
              <CheatReelGridEditor
                cheatGrid={cheatGrid}
                canCheat={canCheat}
                onCellChange={updateCheatCell}
              />
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  onClick={sendCheat}
                  disabled={!canCheat}
                >
                  Set cheat (2001)
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={sendForceJackpot}
                  disabled={!canCheat}
                >
                  Force jackpot next spin (2002)
                </button>
              </div>
            </div>

            <div className="action-group">
              <h3>Session</h3>
              <p className="phase">
                Phase: <strong>{phase}</strong>
              </p>
              {cheatStatus ? <p className="phase">{cheatStatus}</p> : null}

              {error ? <p className="error">{error}</p> : null}
            </div>
          </section>

          <section className="panel output-pane">
            <h2>Output</h2>
            <div className="output-sections">
              <section className="output-section jackpot-pools-section">
                <JackpotPoolsBar
                  poolsByTier={jackpotPoolsByTier}
                  connected={sessionReady}
                  loading={jackpotPoolsLoading}
                />
              </section>
              <section className="output-section">
                <h3>Result</h3>
                {displaySpin ? (
                  <>
                    {jackpotInfo?.triggered ? (
                      <div className="jackpot-banner">
                        <strong>Jackpot</strong>{" "}
                        <span className="jackpot-tier">
                          {jackpotInfo.tier ?? "—"}
                        </span>
                        <span className="jackpot-win">
                          +{jackpotInfo.jackpotWin.toFixed(2)}
                        </span>
                        <span className="muted jackpot-cells">
                          ({jackpotInfo.goldenWildPositions.length} GW cells)
                        </span>
                      </div>
                    ) : null}
                    {retriggerInfo?.triggered ? (
                      <div className="jackpot-banner">
                        <strong>Retrigger</strong>{" "}
                        <span className="jackpot-win">
                          +{retriggerInfo.addedFreeSpins} free spins
                        </span>
                        <span className="muted jackpot-cells">
                          ({retriggerInfo.scatterCount} scatters,{" "}
                          {retriggerInfo.scatterPositions.length} positions)
                        </span>
                      </div>
                    ) : null}
                    <div className="winway-toolbar row">
                      <label className="winway-select-label">
                        Highlight win way
                        <select
                          value={String(safeHighlightIndex)}
                          onChange={(e) =>
                            setHighlightWinWayIndex(Number(e.target.value))
                          }
                          disabled={phase === "spinning"}
                        >
                          {winWays.map((way, idx) => (
                            <option
                              key={`winway-opt-${way.symbol}-${idx}`}
                              value={String(idx)}
                            >
                              #{idx + 1} {way.symbol} ×{way.matchCount} ways=
                              {way.ways} payout=
                              {way.payout}
                            </option>
                          ))}
                          <option value="all">All</option>
                        </select>
                      </label>
                    </div>
                    <div className="reels-wrap">
                      <div className="reels" aria-label="Spin result reels">
                        {displaySpin.spin ? (
                          displaySpin.spin.reels.map((column, ci) => (
                            <div
                              key={`spin-reel-r${ci + 1}-cells-${column.length}`}
                              className="reel-col"
                            >
                              {column.map((sym, ri) => {
                                const k = winWayHighlightKey(ci, ri);
                                const winHit = winWayHighlightKeys.has(k);
                                const gwHit = goldenWildHighlightKeys.has(k);
                                return (
                                  <div
                                    key={`spin-reel-r${ci + 1}-slot-${ri + 1}`}
                                    className={`cell sym-${sym}${winHit ? " cell-winway" : ""}${
                                      gwHit ? " cell-golden-wild" : ""
                                    }`}
                                  >
                                    {sym}
                                  </div>
                                );
                              })}
                            </div>
                          ))
                        ) : (
                          <p className="muted">No spin data in this round.</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="muted">No spin yet.</p>
                )}
              </section>

              <section className="output-section">
                <h3>State</h3>
                {displaySpin ? (
                  <div className="snapshot">
                    <div>
                      <h3>Round</h3>
                      <pre>{JSON.stringify(displaySpin.round, null, 2)}</pre>
                    </div>
                    <div>
                      <h3>State</h3>
                      <pre>{JSON.stringify(displaySpin.state, null, 2)}</pre>
                    </div>
                    <div>
                      <h3>Spin</h3>
                      <pre>
                        {displaySpin.spin
                          ? JSON.stringify(
                              {
                                spinId: displaySpin.spin.spinId,
                                spinType: displaySpin.spin.spinType,
                                win: displaySpin.spin.win,
                                triggers: displaySpin.spin.triggers,
                                winWays: displaySpin.spin.winWays ?? [],
                                guardianWild:
                                  displaySpin.spin.guardianWild ?? null,
                                retrigger: readSpinRetrigger(displaySpin.spin),
                                jackpot: readSpinJackpot(displaySpin.spin),
                              },
                              null,
                              2,
                            )
                          : "null"}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <p className="muted">No spin yet.</p>
                )}
              </section>

              <section className="output-section">
                <h3>Logs</h3>
                {log.length > 0 ? (
                  <ul className="log">
                    {log.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No logs yet.</p>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
