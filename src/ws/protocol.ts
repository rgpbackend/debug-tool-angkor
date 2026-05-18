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

export interface SpinResponsePayload {
  /** Wallet balance after spin when server includes it. */
  balance?: string;
  spin: {
    spinId: string;
    spinType: string;
    reels: string[][];
    /** Credited line/feature win for this spin (decimal string on wire). */
    win: string | number;
    triggers: string[];
    winWays?: WinWay[];
    guardianWild?: any;
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
    bet: number;
    totalWin: number;
    isFinished: boolean;
  };
  state: {
    freeSpin: {
      active: boolean;
      spinsLeft: number;
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
      stickyWildExpansionSteps: Record<string, number>;
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
  symbols: string[];
  /** Allowed stake amounts as decimal strings (§1.1). */
  betLevels?: string[];
  balance?: string;
  paylines?: unknown;
  lastRound: LastRound | null;
}

export interface WinWay {
  symbol: string;
  matchCount: number;
  ways: number;
  payout: number;
  positions: number[][];
}

// --- History (cmd 1502 / 1503) ---

export interface HistoryItem {
  roundId: string;
  spinId: string;
  transactionId: string;
  spinType: "BASE" | "FREE_SPIN" | "RESPIN";
  stepIndex: number;
  /** Parent round display time (finishedAt / updatedAt). Not exact spin instant. */
  timestampMillis: number;
  /** Only BASE step carries round stake; FREE_SPIN / RESPIN use 0. */
  bet: number;
  win: number;
  profit: number;
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

/** Fixed-prize tiers (seed amount is the displayed prize). */
export const STATIC_JACKPOT_TIERS: readonly JackpotTier[] = [
  "NANO",
  "CYBER",
] as const;

/** Progressive pool tiers (current amount grows until won). */
export const PROGRESSIVE_JACKPOT_TIERS: readonly JackpotTier[] = [
  "GUARDIAN",
  "ETERNAL",
] as const;

export function isStaticJackpotTier(tier: JackpotTier): boolean {
  return (STATIC_JACKPOT_TIERS as readonly string[]).includes(tier);
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

export interface HistoryDetailPayload {
  cmd: string | number;
  roundId: string;
  transactionId: string;
  /** Parent round display time — same semantics as HistoryItem.timestampMillis. */
  finishedAtMillis: number;
  spinId: string;
  /** 0-based index of this spin within its parent round. */
  stepIndex: number;
  /** 1-based step display number. */
  round: number;
  spinType: "BASE" | "FREE_SPIN" | "RESPIN";
  /** Human label: "Normal spin" | "Free spin" | "Respin" */
  title: string;
  /** Only BASE step carries round stake; FREE_SPIN / RESPIN use 0. */
  bet: number;
  win: number;
  profit: number;
  /** Column-major grid, same layout as live spin reels. */
  reels: string[][];
  winWays: HistoryWinWay[];
}
