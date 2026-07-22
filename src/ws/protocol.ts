export type WsOutboundFrame =
  | [number, Record<string, unknown>]
  | [number, string, string, Record<string, unknown>]
  | [number, string, string, string, Record<string, unknown>]
  | [string, string, string, number];

export function hasCmd(
  payload: Record<string, unknown>,
  expected: string,
): boolean {
  const cmd = payload.cmd;
  return cmd === expected || cmd === Number(expected);
}

export type SymbolKind =
  | "LOW_PAY"
  | "MID_PAY"
  | "HIGH_PAY"
  | "WILD"
  | "GOLDEN_WILD"
  | "SCATTER";

const SYMBOL_KINDS: readonly SymbolKind[] = [
  "LOW_PAY",
  "MID_PAY",
  "HIGH_PAY",
  "WILD",
  "GOLDEN_WILD",
  "SCATTER",
];

export interface GameSymbol {
  id: string;
  kind?: SymbolKind;
  payouts?: Record<string, string>;
  substitutes?: boolean;
}

export interface GuardianWildPayload {
  triggered: boolean;
  originalReels: string[][];
  addedPositions: [number, number][];
}

export interface SpinResponsePayload {
  /** Wallet balance after this spin's settlement (decimal string, §1.1). */
  balance?: string;
  spin: {
    spinType: string;
    reels: string[][];
    /** Credited line/feature win for this spin (decimal string on wire). */
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
      /** Decimal string on wire (§1.1); not subject to line win cap. */
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

// --- Titan spin response (cmd 1500) ---

export interface TitanPaylineWin {
  paylineId: string;
  symbol: string;
  count: number;
  winAmount: number;
  direction: "LTR" | "RTL";
}

export interface TitanSpinResponsePayload {
  cmd: number;
  c: number;
  spin: {
    spinIndex: number;
    /** Flat 15-char grid string (column-major: reel0[0..2], reel1[0..2], ...). */
    patternGrid: string;
    winAmount: number;
    paylineWins: TitanPaylineWin[];
    superBet?: boolean;
  };
  round: {
    roundId: string;
    totalWin: number;
    roundState: "ONGOING" | "ENDED";
  };
  state: {
    isLastSpin: boolean;
  };
}

/** Decode flat patternGrid (row-major) into column-major reels grid (5×3).
 *  Row-major layout: first 5 chars = top row, next 5 = middle, last 5 = bottom. */
export function decodePatternGrid(flat: string): string[][] {
  const reels: string[][] = [[], [], [], [], []];
  for (let reel = 0; reel < 5; reel++) {
    for (let row = 0; row < 3; row++) {
      const idx = row * 5 + reel;
      reels[reel].push(flat[idx] ?? "?");
    }
  }
  return reels;
}

// --- Join response (cmd 1005) ---

/** lastRound uses the same { round, spin, state } shape as SpinResponsePayload,
 *  but `spin` can be absent when the round has no spins yet. */
export type LastRound = Omit<SpinResponsePayload, 'spin'> & {
  spin?: SpinResponsePayload['spin'] | null;
};

export interface ServerPayline {
  id: string;
  rows: number[];
}

export interface JoinResponsePayload {
  cmd: string | number;
  c: number;
  symbols: GameSymbol[];
  /** Allowed stake amounts as decimal strings (§1.1). */
  betLevels?: string[];
  /** Paylines from server (e.g. Titan's Wrath 10 paylines). */
  paylines?: ServerPayline[];
  /** Wallet balance at join time (decimal string, §1.1). */
  balance?: string;
  lastRound: LastRound | null;
}

// --- GET_BALANCE response (cmd 1530, client query) ---

export interface GetBalanceResponsePayload {
  cmd: string | number;
  c: number;
  balance: string;
  reason: "QUERY";
  roundId: null;
  timestampMillis: number;
}

export function parseGetBalancePayload(
  payload: Record<string, unknown>,
): GetBalanceResponsePayload | null {
  if (payload.reason !== "QUERY") {
    return null;
  }
  const balance = readWireDecimalString(payload.balance);
  if (!balance) {
    return null;
  }
  if (payload.roundId !== null && payload.roundId !== undefined) {
    return null;
  }
  return {
    cmd: payload.cmd as string | number,
    c: Number(payload.c ?? 0),
    balance,
    reason: "QUERY",
    roundId: null,
    timestampMillis: Number(payload.timestampMillis ?? 0),
  };
}

export interface WinWay {
  symbol: string;
  matchCount: number;
  ways: number;
  payout: string | number;
  positions: number[][];
}

// --- History (cmd 1502 / 1503) ---

export type HistorySpinType = "BASE" | "FREE_SPIN" | "RESPIN";

/** Same contract as live spin `jackpot` (1500) and history wire payloads. */
export interface HistoryJackpotSnapshot {
  triggered: boolean;
  tier: string | null;
  jackpotWin: string;
  goldenWildPositions: [number, number][];
}

export interface HistoryItem {
  roundId: string;
  /** 0-based index within the parent round (Level 2 `spinIndex`). */
  spinIndex: number;
  transactionId: string;
  spinType: HistorySpinType;
  /** Same value as `spinIndex` on the wire. */
  stepIndex: number;
  /** Parent round display time (finishedAt / updatedAt). Not exact spin instant. */
  timestampMillis: number;
  /** Only BASE step carries round stake; FREE_SPIN / RESPIN use 0. */
  bet: number;
  win: number;
  profit: number;
  totalStepsInRound?: number;
  jackpot?: HistoryJackpotSnapshot;
}

export interface HistoryListPayload {
  cmd: string | number;
  items: HistoryItem[];
  /** 1-based page echoed from the server (guide §8.1). */
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
  /** Reel-major: positions[i] = winning row indices on reel i. */
  positions: number[][];
}

// --- Jackpot pools (cmd 1510 / 1520) & win history (1511) ---

export type JackpotTier = string;

/** Per-game tier metadata — kept minimal to avoid coupling protocol to game registry. */
export interface JackpotTierInfo {
  key: string;
  isStatic: boolean;
  betMultiplier?: number;
}

export function getJackpotTierKeys(
  tiers: readonly JackpotTierInfo[],
): JackpotTier[] {
  return tiers.map((t) => t.key);
}

export function findJackpotTierInfo(
  tiers: readonly JackpotTierInfo[],
  tier: string,
): JackpotTierInfo | undefined {
  return tiers.find((t) => t.key === tier);
}

export function isStaticJackpotTier(
  tiers: readonly JackpotTierInfo[],
  tier: string,
): boolean {
  const info = findJackpotTierInfo(tiers, tier);
  return info?.isStatic === true;
}

/** Static tier display amount: bet × multiplier (4 dp). */
export function formatStaticJackpotPoolAmount(
  tiers: readonly JackpotTierInfo[],
  bet: string,
  tier: string,
): string | null {
  const info = findJackpotTierInfo(tiers, tier);
  if (!info?.isStatic || !info.betMultiplier) {
    return null;
  }
  const betNum = Number(bet);
  if (!Number.isFinite(betNum)) {
    return null;
  }
  return (betNum * info.betMultiplier).toFixed(4);
}

export interface JackpotPool {
  poolId: string;
  tier: JackpotTier;
  status: string;
  seedAmount: string;
  currentAmount: string;
  createdAt: number;
}

export interface JackpotPoolsPayload {
  cmd: string | number;
  pools: JackpotPool[];
}

export interface JackpotWinnerPush {
  cmd: string | number;
  tier: JackpotTier;
  winAmount: string;
  userId: string;
  agencyId: number;
  roundId: string;
  poolId: string;
  occurredAt: number;
}

export interface JackpotGoldenWildPosition {
  reelIndex: number;
  rowIndex: number;
}

export interface JackpotWinHistoryItem {
  id: string;
  poolId: string;
  tier: JackpotTier;
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

export type JackpotPoolsByTier = Record<string, JackpotPool | null>;

export function emptyJackpotPoolsByTier(
  tiers: readonly JackpotTierInfo[],
): JackpotPoolsByTier {
  const record: JackpotPoolsByTier = {};
  for (const t of tiers) {
    record[t.key] = null;
  }
  return record;
}

export function mergeJackpotPools(
  prev: JackpotPoolsByTier,
  pools: JackpotPool[],
): JackpotPoolsByTier {
  const next = { ...prev };
  for (const pool of pools) {
    next[pool.tier] = pool;
  }
  return next;
}

function isJackpotTier(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Parse `pools` array from spin (1500), join, or jackpot cmd payloads. */
export function parseJackpotPoolsFromPayload(
  payload: Record<string, unknown>,
): JackpotPool[] | null {
  const raw = payload.pools;
  if (!Array.isArray(raw)) {
    return null;
  }
  const pools: JackpotPool[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const p = entry as Record<string, unknown>;
    if (
      typeof p.poolId === "string" &&
      isJackpotTier(p.tier) &&
      typeof p.status === "string" &&
      typeof p.seedAmount === "string" &&
      typeof p.currentAmount === "string" &&
      typeof p.createdAt === "number"
    ) {
      pools.push({
        poolId: p.poolId,
        tier: p.tier,
        status: p.status,
        seedAmount: p.seedAmount,
        currentAmount: p.currentAmount,
        createdAt: p.createdAt,
      });
    }
  }
  return pools.length > 0 ? pools : null;
}

function readHistorySpinType(value: unknown): HistorySpinType {
  if (value === "BASE" || value === "FREE_SPIN" || value === "RESPIN") {
    return value;
  }
  return "BASE";
}

/** Monetary fields on history wire payloads (§1.1 decimal strings). */
function parseHistoryJackpot(raw: unknown): HistoryJackpotSnapshot | undefined {
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

export interface HistoryDetailPayload {
  cmd: string | number;
  roundId: string;
  transactionId: string;
  /** Parent round display time — same semantics as HistoryItem.timestampMillis. */
  finishedAtMillis: number;
  /** 0-based index of this spin within its parent round. */
  spinIndex: number;
  stepIndex: number;
  /** Total spin steps in the parent round (`spins.length`). */
  totalStepsInRound: number;
  spinType: HistorySpinType;
  /** Only BASE step carries round stake; FREE_SPIN / RESPIN use 0. */
  bet: number;
  win: number;
  profit: number;
  /** Column-major grid, same layout as live spin reels. */
  reels: string[][];
  winWays: HistoryWinWay[];
  jackpot?: HistoryJackpotSnapshot;
}

function isSymbolKind(value: unknown): value is SymbolKind {
  return (
    typeof value === "string" &&
    (SYMBOL_KINDS as readonly string[]).includes(value)
  );
}

function readWireDecimalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(4);
  }
  return undefined;
}

/** Top-level `balance` on join (1005) or spin (1500) payloads. */
export function readTopLevelBalance(
  payload: Record<string, unknown>,
): string | null {
  return readWireDecimalString(payload.balance) ?? null;
}

export function parseGameSymbols(raw: unknown): GameSymbol[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const symbols: GameSymbol[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string") {
      continue;
    }
    // kind is optional — server may omit it (e.g. Titan's Wrath).
    if (row.kind !== undefined && !isSymbolKind(row.kind)) {
      continue;
    }
    let payouts: Record<string, string> | undefined;
    if (
      row.payouts !== null &&
      typeof row.payouts === "object" &&
      !Array.isArray(row.payouts)
    ) {
      const parsed: Record<string, string> = {};
      for (const [key, val] of Object.entries(
        row.payouts as Record<string, unknown>,
      )) {
        if (typeof val === "string") {
          parsed[key] = val;
        } else if (typeof val === "number" && Number.isFinite(val)) {
          parsed[key] = String(val);
        }
      }
      if (Object.keys(parsed).length > 0) {
        payouts = parsed;
      }
    }
    symbols.push({
      id: row.id,
      kind: row.kind,
      ...(payouts ? { payouts } : {}),
      ...(row.substitutes === true ? { substitutes: true } : {}),
    });
  }
  return symbols;
}

export function parseJoinResponsePayload(
  payload: Record<string, unknown>,
): JoinResponsePayload {
  // Accept both string and numeric bet levels from server.
  const rawBetLevels = Array.isArray(payload.betAmounts) ? payload.betAmounts : undefined;
  const betLevels = rawBetLevels
    ?.filter(
      (level): level is string | number =>
        typeof level === "string" || typeof level === "number",
    )
    .map((level) =>
      typeof level === "number" ? String(level) : (level as string),
    );

  // Parse paylines from server response (e.g. Titan's Wrath).
  const paylines = parseServerPaylines(payload.paylines);

  const lastRound =
    payload.lastRound === null || payload.lastRound === undefined
      ? null
      : (payload.lastRound as LastRound);
  const balance = readTopLevelBalance(payload);
  return {
    cmd: payload.cmd as string | number,
    c: Number(payload.c ?? 0),
    symbols: parseGameSymbols(payload.symbols),
    ...(betLevels?.length ? { betLevels } : {}),
    ...(paylines?.length ? { paylines } : {}),
    ...(balance ? { balance } : {}),
    lastRound,
  };
}

function parseServerPaylines(raw: unknown): ServerPayline[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const result: ServerPayline[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== "string") continue;
    if (!Array.isArray(p.rows)) continue;
    const rows = p.rows.filter((r): r is number => typeof r === "number");
    if (rows.length === 0) continue;
    result.push({ id: p.id, rows });
  }
  return result.length > 0 ? result : undefined;
}

/** Tuple `[reel, row]` or object `{ reelIndex, rowIndex }` on wire. */
export function parseJackpotGoldenWildPositions(
  raw: unknown,
): [number, number][] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const positions: [number, number][] = [];
  for (const item of raw) {
    if (
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === "number" &&
      typeof item[1] === "number"
    ) {
      positions.push([item[0], item[1]]);
      continue;
    }
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      const row = item as Record<string, unknown>;
      const reelIndex = row.reelIndex;
      const rowIndex = row.rowIndex;
      if (typeof reelIndex === "number" && typeof rowIndex === "number") {
        positions.push([reelIndex, rowIndex]);
      }
    }
  }
  return positions;
}
