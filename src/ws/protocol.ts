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

// --- Join response (cmd 1005) ---

export interface ServerPayline {
  id: string;
  rows: number[];
}

/** Jackpot tier entry from JOIN config (e.g. Titan's Wrath Olympus Jackpot). */
export interface JackpotTierEntry {
  tier: string;
  requiredTokens: number;
  multiplier: number;
}

/** Minimal shared last-round type — games define their own typed versions. */
export interface LastRound {
  round?: Record<string, unknown>;
  spin?: Record<string, unknown> | null;
  state?: Record<string, unknown>;
  [key: string]: unknown;
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
  /** Jackpot tier definitions from server (e.g. Olympus Jackpot). */
  jackpotTiers?: JackpotTierEntry[];
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

function isSymbolKind(value: unknown): value is SymbolKind {
  return (
    typeof value === "string" &&
    (SYMBOL_KINDS as readonly string[]).includes(value)
  );
}

export function readWireDecimalString(value: unknown): string | undefined {
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
  const rawBetLevels = Array.isArray(payload.betAmounts) ? payload.betAmounts
    : Array.isArray(payload.betLevels) ? payload.betLevels : undefined;
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

  // Parse jackpot tiers from server (e.g. Titan's Wrath Olympus Jackpot).
  const jackpotTiers = parseJackpotTiers(payload.jackpotTiers);

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
    ...(jackpotTiers?.length ? { jackpotTiers } : {}),
  };
}

function parseJackpotTiers(raw: unknown): JackpotTierEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const result: JackpotTierEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const t = item as Record<string, unknown>;
    if (typeof t.tier !== "string") continue;
    if (typeof t.requiredTokens !== "number") continue;
    if (typeof t.multiplier !== "number") continue;
    result.push({
      tier: t.tier,
      requiredTokens: t.requiredTokens,
      multiplier: t.multiplier,
    });
  }
  return result.length > 0 ? result : undefined;
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
