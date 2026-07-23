/**
 * Angkor-specific protocol types, matchers, and parsers.
 * Moved out of shared ws/ to keep game flows isolated.
 */
import {
  hasCmd,
  readWireDecimalString,
  parseJackpotGoldenWildPositions,
  type JackpotGoldenWildPosition,
} from "../../../ws/protocol";

// ---------------------------------------------------------------------------
// Angkor spin / win-way types (cmd 1500)
// ---------------------------------------------------------------------------

export interface GuardianWildPayload {
  triggered: boolean;
  originalReels: string[][];
  addedPositions: [number, number][];
}

export interface WinWay {
  symbol: string;
  matchCount: number;
  ways: number;
  payout: string | number;
  positions: number[][];
}

export interface SpinResponsePayload {
  balance?: string;
  spin: {
    spinType: string;
    reels: string[][];
    win: string | number;
    triggers: string[];
    winWays?: WinWay[];
    guardianWild: GuardianWildPayload;
    retrigger: {
      triggered: boolean;
      scatterCount: number;
      addedFreeSpins: number;
      scatterPositions: [number, number][];
    };
    jackpot: {
      triggered: boolean;
      tier: string | null;
      jackpotWin: string | number;
      goldenWildPositions: [number, number][];
    };
  };
  round: {
    roundId: string;
    state: string;
    bet: string | number;
    totalWin: string | number;
    isFinished: boolean;
    winCapReached: boolean;
  };
  state: {
    freeSpin: {
      active: boolean;
      spinsLeft: number;
      preScatterCount?: number;
      scatterCollected: number;
      triggeredScatterCount: number;
      initialFreeSpinCount?: number;
      currentStep: number;
      totalSteps: number;
    };
    respin: {
      active: boolean;
      origin: string;
      currentStep: number;
      totalSteps: number;
      spinsLeft: number;
      stickyWildAnchorRows: Record<string, number>;
    };
  };
}

export type LastRound = Omit<SpinResponsePayload, "spin"> & {
  spin?: SpinResponsePayload["spin"] | null;
};

// ---------------------------------------------------------------------------
// Spin matchers (Angkor-specific — checks for `spin.jackpot`)
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isSpinResponsePayload(
  payload: Record<string, unknown>,
): boolean {
  if (
    !hasCmd(payload, "1500") ||
    !isObject(payload.spin) ||
    !isObject(payload.round) ||
    !isObject(payload.state)
  ) {
    return false;
  }
  const spin = payload.spin as Record<string, unknown>;
  return isObject(spin.jackpot);
}

export function isSpinErrorPayload(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1500")) {
    return false;
  }
  return payload.c === 1 || payload.errorCode != null;
}

// ---------------------------------------------------------------------------
// History types & parsers (cmd 1502 / 1503)
// ---------------------------------------------------------------------------

export type HistorySpinType = "BASE" | "FREE_SPIN" | "RESPIN";

export interface HistoryJackpotSnapshot {
  triggered: boolean;
  tier: string | null;
  jackpotWin: string;
  goldenWildPositions: [number, number][];
}

export interface HistoryItem {
  roundId: string;
  spinIndex: number;
  transactionId: string;
  spinType: HistorySpinType;
  stepIndex: number;
  timestampMillis: number;
  bet: number;
  win: number;
  profit: number;
  totalStepsInRound?: number;
  jackpot?: HistoryJackpotSnapshot;
}

export interface HistoryListPayload {
  cmd: string | number;
  items: HistoryItem[];
  page: number;
  size: number;
  totalItems: number;
  totalPage: number;
}

export interface HistoryWinWay {
  wayIndex: number;
  symbol: string;
  matchCount: number;
  ways: number;
  payout: number;
  positions: number[][];
}

export interface HistoryDetailPayload {
  cmd: string | number;
  roundId: string;
  transactionId: string;
  finishedAtMillis: number;
  spinIndex: number;
  stepIndex: number;
  totalStepsInRound: number;
  spinType: HistorySpinType;
  bet: number;
  win: number;
  profit: number;
  reels: string[][];
  winWays: HistoryWinWay[];
  jackpot?: HistoryJackpotSnapshot;
}

function readHistorySpinType(value: unknown): HistorySpinType {
  if (value === "BASE" || value === "FREE_SPIN" || value === "RESPIN") {
    return value;
  }
  return "BASE";
}

function parseHistoryJackpot(
  raw: unknown,
): HistoryJackpotSnapshot | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }
  const j = raw as Record<string, unknown>;
  const jackpotWin = readWireDecimalString(j.jackpotWin);
  if (!jackpotWin) {
    return undefined;
  }
  return {
    triggered: Boolean(j.triggered),
    tier: typeof j.tier === "string" ? j.tier : null,
    jackpotWin,
    goldenWildPositions: parseJackpotGoldenWildPositions(j.goldenWildPositions),
  };
}

function readHistoryAmount(value: unknown): number {
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function parseHistoryWinWay(
  entry: unknown,
  fallbackIndex: number,
): HistoryWinWay | null {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const positions = Array.isArray(row.positions)
    ? (row.positions as unknown[]).map((col) =>
        Array.isArray(col) ? col.map((r) => Number(r)) : [],
      )
    : [];
  return {
    wayIndex:
      typeof row.wayIndex === "number" ? row.wayIndex : fallbackIndex,
    symbol: String(row.symbol ?? ""),
    matchCount: Number(row.matchCount ?? 0),
    ways: Number(row.ways ?? 0),
    payout: readHistoryAmount(row.payout),
    positions,
  };
}

export function parseHistoryListItem(row: unknown): HistoryItem | null {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return null;
  }
  const r = row as Record<string, unknown>;
  if (typeof r.roundId !== "string") {
    return null;
  }
  const spinIndex = Number(r.spinIndex ?? r.stepIndex ?? 0);
  const totalStepsInRound = Number(r.totalStepsInRound ?? 0);
  const jackpot = parseHistoryJackpot(r.jackpot);
  return {
    roundId: r.roundId,
    spinIndex,
    transactionId:
      typeof r.transactionId === "string" ? r.transactionId : r.roundId,
    spinType: readHistorySpinType(r.spinType),
    stepIndex: Number(r.stepIndex ?? spinIndex),
    timestampMillis: Number(r.timestampMillis ?? 0),
    bet: readHistoryAmount(r.bet),
    win: readHistoryAmount(r.win),
    profit: readHistoryAmount(r.profit),
    ...(totalStepsInRound > 0 ? { totalStepsInRound } : {}),
    ...(jackpot ? { jackpot } : {}),
  };
}

export function parseHistoryListPayload(
  payload: Record<string, unknown>,
): HistoryListPayload {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems
    .map((row) => parseHistoryListItem(row))
    .filter((item): item is HistoryItem => item !== null);
  return {
    cmd: payload.cmd as string | number,
    items,
    page: Number(payload.page ?? 1),
    size: Number(payload.size ?? 6),
    totalItems: Number(payload.totalItems ?? 0),
    totalPage: Number(payload.totalPage ?? 0),
  };
}

export function parseHistoryDetailPayload(
  payload: Record<string, unknown>,
): HistoryDetailPayload {
  const spinIndex = Number(payload.spinIndex ?? payload.stepIndex ?? 0);
  const rawWinWays = Array.isArray(payload.winWays) ? payload.winWays : [];
  const winWays: HistoryWinWay[] = [];
  rawWinWays.forEach((entry, idx) => {
    const way = parseHistoryWinWay(entry, idx);
    if (way) {
      winWays.push(way);
    }
  });
  const reels = Array.isArray(payload.reels)
    ? (payload.reels as unknown[]).map((col) =>
        Array.isArray(col) ? col.map((sym) => String(sym)) : [],
      )
    : [];
  const totalStepsInRound = Number(payload.totalStepsInRound ?? 0);
  const jackpot = parseHistoryJackpot(payload.jackpot);

  return {
    cmd: payload.cmd as string | number,
    roundId: String(payload.roundId ?? ""),
    transactionId: String(
      payload.transactionId ?? payload.roundId ?? "",
    ),
    finishedAtMillis: Number(payload.finishedAtMillis ?? 0),
    spinIndex,
    stepIndex: Number(payload.stepIndex ?? spinIndex),
    totalStepsInRound,
    spinType: readHistorySpinType(payload.spinType),
    bet: readHistoryAmount(payload.bet),
    win: readHistoryAmount(payload.win),
    profit: readHistoryAmount(payload.profit),
    reels,
    winWays,
    ...(jackpot ? { jackpot } : {}),
  };
}

// ---------------------------------------------------------------------------
// History matchers (Angkor-specific)
// ---------------------------------------------------------------------------

export function isHistoryListPayload(
  payload: Record<string, unknown>,
): boolean {
  return (
    hasCmd(payload, "1502") &&
    Array.isArray(payload.items) &&
    typeof payload.totalItems === "number" &&
    typeof payload.totalPage === "number"
  );
}

export function isHistoryDetailPayload(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1503")) {
    return false;
  }
  if (payload.c === 1 || payload.errorCode != null) {
    return false;
  }
  return (
    typeof payload.roundId === "string" &&
    Array.isArray(payload.reels) &&
    (typeof payload.spinIndex === "number" ||
      typeof payload.stepIndex === "number")
  );
}

export function isJackpotWinHistoryPayload(
  payload: Record<string, unknown>,
): boolean {
  return hasCmd(payload, "1511") && Array.isArray(payload.items);
}

export function isForceJackpotResponse(
  payload: Record<string, unknown>,
): boolean {
  return (
    hasCmd(payload, "2002") &&
    payload.c !== 1 &&
    payload.errorCode == null &&
    typeof payload.tier === "string"
  );
}

// ---------------------------------------------------------------------------
// Jackpot win history types (Angkor-specific)
// ---------------------------------------------------------------------------

export interface JackpotWinHistoryItem {
  id: string;
  poolId: string;
  tier: string;
  roundId: string;
  userId: string;
  agencyId: number;
  betAmount: string;
  winAmount: string;
  poolAmountAtWin: string;
  goldenWildPositions: JackpotGoldenWildPosition[];
  createdAt: number;
}

export interface JackpotWinHistoryPayload {
  cmd: string | number;
  items: JackpotWinHistoryItem[];
  count: number;
}
