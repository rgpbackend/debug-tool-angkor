export type WsFrame2 = [number, Record<string, unknown>];
export type WsFrame4 = [number, string, string, Record<string, unknown>];
export type WsFrame5 = [
  number,
  string,
  string,
  string,
  Record<string, unknown>,
];
export type WsFrame = WsFrame2 | WsFrame4 | WsFrame5;
export type HeartbeatFrame = [string, string, string, number];
export type WsOutboundFrame = WsFrame | HeartbeatFrame;

export function getFramePayload(frame: WsFrame): Record<string, unknown> {
  return frame.at(-1) as Record<string, unknown>;
}

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
  displayName: string;
  kind: SymbolKind;
  payouts?: Record<string, string>;
  substitutes?: boolean;
}

export interface GuardianWildPayload {
  triggered: boolean;
  originalReels: string[][];
  addedPositions: [number, number][];
}

export interface SpinResponsePayload {
  spin: {
    spinType: string;
    reels: string[][];
    /** Credited line/feature win for this spin (decimal string on wire). */
    win: string | number;
    balanceBefore?: string;
    balanceAfter?: string;
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
  };
  state: {
    freeSpin: {
      active: boolean;
      spinsLeft: number;
      preScatterCount?: number;
      scatterCollected: number;
      triggeredScatterCount: number;
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

// --- Join response (cmd 1005) ---

/** lastRound uses the same { round, spin, state } shape as SpinResponsePayload,
 *  but `spin` can be absent when the round has no spins yet. */
export type LastRound = Omit<SpinResponsePayload, 'spin'> & {
  spin?: SpinResponsePayload['spin'] | null;
};

export interface JoinResponsePayload {
  cmd: string | number;
  c: number;
  symbols: GameSymbol[];
  /** Allowed stake amounts as decimal strings (§1.1). */
  betLevels?: string[];
  balance?: string;
  lastRound: LastRound | null;
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
  balanceBefore?: string;
  balanceAfter?: string;
}

export interface HistoryListPayload {
  cmd: string | number;
  items: HistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
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

export type JackpotTier = "NANO" | "CYBER" | "GUARDIAN" | "ETERNAL";

export const JACKPOT_TIERS: readonly JackpotTier[] = [
  "NANO",
  "CYBER",
  "GUARDIAN",
  "ETERNAL",
] as const;

/** Fixed-prize tiers (prize = bet × tier multiplier). */
export const STATIC_JACKPOT_TIERS = ["NANO", "CYBER"] as const satisfies readonly JackpotTier[];

export type StaticJackpotTier = (typeof STATIC_JACKPOT_TIERS)[number];

export const STATIC_JACKPOT_BET_MULTIPLIERS: Record<StaticJackpotTier, number> = {
  NANO: 20,
  CYBER: 50,
};

/** Progressive pool tiers (current amount grows until won). */
export const PROGRESSIVE_JACKPOT_TIERS = ["GUARDIAN", "ETERNAL"] as const satisfies readonly JackpotTier[];

export function isStaticJackpotTier(tier: JackpotTier): tier is StaticJackpotTier {
  return (STATIC_JACKPOT_TIERS as readonly string[]).includes(tier);
}

/** Static tier display amount: bet × multiplier (4 dp). */
export function formatStaticJackpotPoolAmount(
  bet: string,
  tier: JackpotTier,
): string | null {
  if (!isStaticJackpotTier(tier)) {
    return null;
  }
  const betNum = Number(bet);
  if (!Number.isFinite(betNum)) {
    return null;
  }
  return (betNum * STATIC_JACKPOT_BET_MULTIPLIERS[tier]).toFixed(4);
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

export type JackpotPoolsByTier = Record<JackpotTier, JackpotPool | null>;

export function emptyJackpotPoolsByTier(): JackpotPoolsByTier {
  return {
    NANO: null,
    CYBER: null,
    GUARDIAN: null,
    ETERNAL: null,
  };
}

export function mergeJackpotPools(
  prev: JackpotPoolsByTier,
  pools: JackpotPool[],
): JackpotPoolsByTier {
  const next = { ...prev };
  for (const pool of pools) {
    if (JACKPOT_TIERS.includes(pool.tier)) {
      next[pool.tier] = pool;
    }
  }
  return next;
}

function isJackpotTier(value: unknown): value is JackpotTier {
  return (
    typeof value === "string" &&
    (JACKPOT_TIERS as readonly string[]).includes(value)
  );
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
  const balanceBefore = readWireDecimalString(r.balanceBefore);
  const balanceAfter = readWireDecimalString(r.balanceAfter);
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
    ...(balanceBefore ? { balanceBefore } : {}),
    ...(balanceAfter ? { balanceAfter } : {}),
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
    page: Number(payload.page ?? 0),
    pageSize: Number(payload.pageSize ?? items.length),
    totalCount: Number(payload.totalCount ?? items.length),
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

  const balanceBefore = readWireDecimalString(payload.balanceBefore);
  const balanceAfter = readWireDecimalString(payload.balanceAfter);

  return {
    cmd: payload.cmd as string | number,
    roundId: String(payload.roundId ?? ""),
    transactionId: String(
      payload.transactionId ?? payload.roundId ?? "",
    ),
    finishedAtMillis: Number(payload.finishedAtMillis ?? 0),
    spinIndex,
    stepIndex: Number(payload.stepIndex ?? spinIndex),
    round: Number(payload.round ?? spinIndex + 1),
    spinType: readHistorySpinType(payload.spinType),
    title: String(payload.title ?? ""),
    bet: readHistoryAmount(payload.bet),
    win: readHistoryAmount(payload.win),
    profit: readHistoryAmount(payload.profit),
    ...(balanceBefore ? { balanceBefore } : {}),
    ...(balanceAfter ? { balanceAfter } : {}),
    reels,
    winWays,
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
  /** 1-based step display number. */
  round: number;
  spinType: HistorySpinType;
  /** Human label: "Normal spin" | "Free spin" | "Respin" */
  title: string;
  /** Only BASE step carries round stake; FREE_SPIN / RESPIN use 0. */
  bet: number;
  win: number;
  profit: number;
  balanceBefore?: string;
  balanceAfter?: string;
  /** Column-major grid, same layout as live spin reels. */
  reels: string[][];
  winWays: HistoryWinWay[];
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
    if (typeof row.id !== "string" || typeof row.displayName !== "string") {
      continue;
    }
    if (!isSymbolKind(row.kind)) {
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
      displayName: row.displayName,
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
  const betLevels = Array.isArray(payload.betLevels)
    ? payload.betLevels.filter(
        (level): level is string => typeof level === "string",
      )
    : undefined;
  const lastRound =
    payload.lastRound === null || payload.lastRound === undefined
      ? null
      : (payload.lastRound as LastRound);
  return {
    cmd: payload.cmd as string | number,
    c: Number(payload.c ?? 0),
    symbols: parseGameSymbols(payload.symbols),
    ...(betLevels?.length ? { betLevels } : {}),
    ...(readWireDecimalString(payload.balance)
      ? { balance: readWireDecimalString(payload.balance) }
      : {}),
    lastRound,
  };
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
