/**
 * Titan's Wrath — protocol types, parsers, and matchers.
 * CMD: 1005 (JOIN), 1500 (SPIN), 1501 (BALANCE_UPDATE), 1502 (JACKPOT_TRIGGERED),
 *      1503 (GAME_HISTORY_LIST), 1504 (GAME_HISTORY_DETAIL), 1505 (JACKPOT_WIN_HISTORY)
 */
import { hasCmd } from "../../ws/protocol";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TitanPaylineWin {
  paylineId: string;   // "P01"–"P10"
  symbol: string;      // winning symbol
  count: number;       // 3, 4, or 5
  winAmount: number;
  direction: "LTR" | "RTL";
}

export interface TitanWildSpinInfo {
  triggered: boolean;
  wildReels: number[];  // 0-based column indices with new wilds
}

export interface TitanWildState {
  active: boolean;
  spinCount: number;
  lockedReels: number[];  // all locked columns (0-based)
}

export interface TitanSpinPayload {
  cmd: 1500;
  c: number;
  spin: {
    spinType: "BASE" | "RESPIN";
    spinIndex: number;
    patternGrid: string;
    winAmount: number;
    paylineWins: TitanPaylineWin[];
    superBet: boolean;
    baseBet: number;
    titanWild?: TitanWildSpinInfo;
    tokenPositions: number[];
    jackpotTier: string | null;
    jackpotPrize: number;
  };
  round: {
    roundId: string;
    state: "ACTIVE" | "RESPIN" | "ENDED";
    betAmount: number;
    totalWin: number;
  };
  state: {
    titanWild: TitanWildState;
  };
}

// ---------------------------------------------------------------------------
// Grid parser
// ---------------------------------------------------------------------------

export function parsePatternGrid(patternGrid: string): string[][] {
  const cols = 5, rows = 3;
  const grid: string[][] = Array.from({ length: cols }, () => []);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      grid[c][r] = patternGrid[r * cols + c] ?? "";
  return grid; // grid[col][row], row: 0=top, 1=mid, 2=bottom
}

// ---------------------------------------------------------------------------
// Spin matchers (cmd 1500)
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isTitanSpinResponse(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1500")) return false;
  if (typeof payload.c !== "number" || payload.c !== 0) return false;
  if (!isObject(payload.spin)) return false;
  if (!isObject(payload.round)) return false;
  if (!isObject(payload.state)) return false;
  const spin = payload.spin as Record<string, unknown>;
  return typeof spin.patternGrid === "string";
}

export function isTitanSpinError(
  payload: Record<string, unknown>,
): boolean {
  return hasCmd(payload, "1500") && payload.c !== 0;
}

// ---------------------------------------------------------------------------
// Spin parser
// ---------------------------------------------------------------------------

function parsePaylineWin(raw: unknown): TitanPaylineWin | null {
  if (!isObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.paylineId !== "string") return null;
  if (typeof r.symbol !== "string") return null;
  if (typeof r.count !== "number") return null;
  const dir = r.direction;
  if (dir !== "LTR" && dir !== "RTL") return null;
  return {
    paylineId: r.paylineId,
    symbol: r.symbol,
    count: r.count,
    winAmount: typeof r.winAmount === "number" ? r.winAmount : 0,
    direction: dir,
  };
}

function parseTitanWildSpin(raw: unknown): TitanWildSpinInfo | undefined {
  if (!isObject(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.triggered !== true) return undefined;
  const wildReels: number[] = [];
  if (Array.isArray(r.wildReels)) {
    for (const v of r.wildReels) {
      if (typeof v === "number") wildReels.push(v);
    }
  }
  return { triggered: true, wildReels };
}

function parseTitanWildState(raw: unknown): TitanWildState {
  if (!isObject(raw)) return { active: false, spinCount: 0, lockedReels: [] };
  const r = raw as Record<string, unknown>;
  const lockedReels: number[] = [];
  if (Array.isArray(r.lockedReels)) {
    for (const v of r.lockedReels) {
      if (typeof v === "number") lockedReels.push(v);
    }
  }
  return {
    active: Boolean(r.active),
    spinCount: typeof r.spinCount === "number" ? r.spinCount : 0,
    lockedReels,
  };
}

function parseTokenPositions(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is number => typeof v === "number" && v >= 0 && v <= 14);
}

export function parseTitanSpinPayload(
  payload: Record<string, unknown>,
): TitanSpinPayload {
  const spin = (payload.spin ?? {}) as Record<string, unknown>;
  const round = (payload.round ?? {}) as Record<string, unknown>;
  const state = (payload.state ?? {}) as Record<string, unknown>;
  const rawWins = Array.isArray(spin.paylineWins) ? spin.paylineWins : [];
  const paylineWins: TitanPaylineWin[] = [];
  for (const entry of rawWins) {
    const win = parsePaylineWin(entry);
    if (win) paylineWins.push(win);
  }
  return {
    cmd: 1500,
    c: 0,
    spin: {
      spinType: (spin.spinType === "RESPIN" ? "RESPIN" : "BASE") as "BASE" | "RESPIN",
      spinIndex: typeof spin.spinIndex === "number" ? spin.spinIndex : 0,
      patternGrid: typeof spin.patternGrid === "string" ? spin.patternGrid : "",
      winAmount: typeof spin.winAmount === "number" ? spin.winAmount : 0,
      paylineWins,
      superBet: Boolean(spin.superBet),
      baseBet: typeof spin.baseBet === "number" ? spin.baseBet : 0,
      ...(spin.titanWild ? { titanWild: parseTitanWildSpin(spin.titanWild) } : {}),
      tokenPositions: parseTokenPositions(spin.tokenPositions),
      jackpotTier: typeof spin.jackpotTier === "string" ? spin.jackpotTier : null,
      jackpotPrize: typeof spin.jackpotPrize === "number" ? spin.jackpotPrize : 0,
    },
    round: {
      roundId: String(round.roundId ?? ""),
      state: (round.state === "RESPIN" ? "RESPIN" : round.state === "ENDED" ? "ENDED" : "ACTIVE") as "ACTIVE" | "RESPIN" | "ENDED",
      betAmount: typeof round.betAmount === "number" ? round.betAmount : 0,
      totalWin: typeof round.totalWin === "number" ? round.totalWin : 0,
    },
    state: {
      titanWild: parseTitanWildState(state.titanWild),
    },
  };
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

const TITAN_ERROR_MAP: Record<number, string> = {
  1300: "Server error. Please try again.",
  1301: "Unsupported command.",
  1302: "Invalid request. Check your inputs.",
  1303: "Grid configuration error. Please try again.",
  1304: "Payline configuration error. Please try again.",
  1305: "Session expired. Reconnecting…",
  1306: "Win evaluation error. Please try again.",
  1307: "Insufficient balance. Deposit to continue.",
  1308: "Round not found. Starting new round.",
  1309: "Round already ended. Spin again.",
  1310: "Spin in progress. Please wait…",
  1311: "Invalid bet amount.",
  1312: "Session out of sync. Reconnecting…",
  1313: "Jackpot meter error. Please try again.",
  1314: "Missing request data. Please try again.",
  1315: "Session ID missing. Reconnecting…",
  1316: "Round settlement error. Please try again.",
  1317: "Debug mode is disabled on server.",
};

export function formatTitanError(c: number, mgs?: string): string {
  return TITAN_ERROR_MAP[c] ?? (mgs ? `${mgs} (code ${c})` : `Error code ${c}`);
}

export function isTitanRespinPending(payload: TitanSpinPayload): boolean {
  return payload.round.state === "RESPIN";
}

export function isTitanRoundEnded(payload: TitanSpinPayload): boolean {
  return payload.round.state === "ENDED";
}

// ---------------------------------------------------------------------------
// BALANCE_UPDATE (1501) — server → client push
// ---------------------------------------------------------------------------

export interface TitanBalanceUpdate {
  cmd: 1501;
  c: number;
  balance: number;
}

export function isTitanBalanceUpdate(
  payload: Record<string, unknown>,
): boolean {
  return (
    hasCmd(payload, "1501") &&
    typeof payload.balance === "number"
  );
}

// ---------------------------------------------------------------------------
// JACKPOT_TRIGGERED (1502) — server → client push
// ---------------------------------------------------------------------------

export type TitanJackpotTier = "MINI" | "MINOR" | "MAJOR" | "GRAND";

export interface TitanJackpotTriggered {
  cmd: 1502;
  c: number;
  tier: TitanJackpotTier;
  prizeAmount: number;
  tokenCount: number;
  playerDisplayName: string;
}

export function isTitanJackpotTriggered(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1502")) return false;
  if (typeof payload.tier !== "string") return false;
  // prizeAmount + tokenCount may arrive as number (per contract) or string
  const prizeOk =
    typeof payload.prizeAmount === "number" ||
    (typeof payload.prizeAmount === "string" && !isNaN(Number(payload.prizeAmount)));
  const tokenOk =
    typeof payload.tokenCount === "number" ||
    (typeof payload.tokenCount === "string" && !isNaN(Number(payload.tokenCount)));
  return prizeOk && tokenOk;
}

// ---------------------------------------------------------------------------
// SESSION_TAKEN_OVER (1006) — server → client push on session eviction
// ---------------------------------------------------------------------------

export function isTitanSessionTakenOver(
  payload: Record<string, unknown>,
): boolean {
  return hasCmd(payload, "1006") && payload.c === 1318;
}

// ---------------------------------------------------------------------------
// GAME_HISTORY_LIST (1503) — client → server, returns all finished spins
// ---------------------------------------------------------------------------

export type TitanHistorySpinType = "BASE" | "RESPIN";

export interface TitanHistoryJackpotSnapshot {
  triggered: boolean;
  tier: string | null;
  prize: string;
}

export interface TitanHistoryItem {
  roundId: string;
  spinIndex: number;
  spinType: TitanHistorySpinType;
  stepIndex: number;
  totalStepsInRound: number;
  timestamp: number;
  bet: string;
  win: string;
  profit: string;
  jackpot?: TitanHistoryJackpotSnapshot;
}

export interface TitanHistoryListPayload {
  cmd: string | number;
  c: number;
  items: TitanHistoryItem[];
  count: number;
}

export function isTitanHistoryListPayload(
  payload: Record<string, unknown>,
): boolean {
  return hasCmd(payload, "1503") && Array.isArray(payload.items);
}

function readTitanHistorySpinType(v: unknown): TitanHistorySpinType {
  if (v === "BASE" || v === "RESPIN") return v;
  return "BASE";
}

function readTitanHistoryAmount(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim()) return v.trim();
  return "0";
}

function parseTitanHistoryJackpot(
  raw: unknown,
): TitanHistoryJackpotSnapshot | undefined {
  if (!isObject(raw)) return undefined;
  const j = raw as Record<string, unknown>;
  const prize = typeof j.prize === "string" ? j.prize : String(j.prize ?? "0");
  return {
    triggered: Boolean(j.triggered),
    tier: typeof j.tier === "string" ? j.tier : null,
    prize,
  };
}

function parseTitanHistoryItem(row: unknown): TitanHistoryItem | null {
  if (!isObject(row)) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.roundId !== "string") return null;
  const jackpot = parseTitanHistoryJackpot(r.jackpot);
  return {
    roundId: r.roundId,
    spinIndex: typeof r.spinIndex === "number" ? r.spinIndex : 0,
    spinType: readTitanHistorySpinType(r.spinType),
    stepIndex: typeof r.stepIndex === "number" ? r.stepIndex : 0,
    totalStepsInRound: typeof r.totalStepsInRound === "number" ? r.totalStepsInRound : 1,
    timestamp: typeof r.timestamp === "number" ? r.timestamp : 0,
    bet: readTitanHistoryAmount(r.bet),
    win: readTitanHistoryAmount(r.win),
    profit: readTitanHistoryAmount(r.profit),
    ...(jackpot ? { jackpot } : {}),
  };
}

export function parseTitanHistoryListPayload(
  payload: Record<string, unknown>,
): TitanHistoryListPayload {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems
    .map((row) => parseTitanHistoryItem(row))
    .filter((item): item is TitanHistoryItem => item !== null);
  return {
    cmd: payload.cmd as string | number,
    c: typeof payload.c === "number" ? payload.c : 0,
    items,
    count: typeof payload.count === "number" ? payload.count : items.length,
  };
}

// ---------------------------------------------------------------------------
// GAME_HISTORY_DETAIL (1504) — client → server, single spin detail
// ---------------------------------------------------------------------------

export interface TitanHistoryWinWay {
  paylineId: string;
  symbol: string;
  count: number;
  win: string;
  direction: "LTR" | "RTL";
}

export interface TitanHistoryDetailPayload {
  cmd: string | number;
  c: number;
  roundId: string;
  spinIndex: number;
  spinType: TitanHistorySpinType;
  stepIndex: number;
  totalStepsInRound: number;
  timestamp: number;
  bet: string;
  win: string;
  profit: string;
  reels: string[][];
  winWays: TitanHistoryWinWay[];
  jackpot?: TitanHistoryJackpotSnapshot;
}

export function isTitanHistoryDetailPayload(
  payload: Record<string, unknown>,
): boolean {
  if (!hasCmd(payload, "1504")) return false;
  if (typeof payload.c === "number" && payload.c !== 0) return false;
  return typeof payload.roundId === "string" && Array.isArray(payload.reels);
}

function parseTitanHistoryWinWay(raw: unknown): TitanHistoryWinWay | null {
  if (!isObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.paylineId !== "string") return null;
  const rawDir = typeof r.direction === "string" ? r.direction.toUpperCase() : "";
  const direction: "LTR" | "RTL" = rawDir === "RTL" ? "RTL" : "LTR";
  return {
    paylineId: r.paylineId,
    symbol: typeof r.symbol === "string" ? r.symbol : "",
    count: typeof r.count === "number" ? r.count : 0,
    win: typeof r.win === "string" ? r.win : String(r.win ?? "0"),
    direction,
  };
}

export function parseTitanHistoryDetailPayload(
  payload: Record<string, unknown>,
): TitanHistoryDetailPayload {
  const rawWays = Array.isArray(payload.winWays) ? payload.winWays : [];
  const winWays: TitanHistoryWinWay[] = [];
  for (const entry of rawWays) {
    const w = parseTitanHistoryWinWay(entry);
    if (w) winWays.push(w);
  }
  const rawReels = Array.isArray(payload.reels)
    ? (payload.reels as unknown[]).map((col) =>
        Array.isArray(col) ? col.map((s) => String(s)) : [],
      )
    : [];
  // Transpose row-major (3 rows × 5 cols) → col-major (5 cols × 3 rows)
  const reels =
    rawReels.length === 3 && rawReels.every((r) => r.length === 5)
      ? Array.from({ length: 5 }, (_, ci) =>
          Array.from({ length: 3 }, (__, ri) => rawReels[ri][ci] ?? ""),
        )
      : rawReels;
  const jackpot = parseTitanHistoryJackpot(payload.jackpot);
  return {
    cmd: payload.cmd as string | number,
    c: typeof payload.c === "number" ? payload.c : 0,
    roundId: String(payload.roundId ?? ""),
    spinIndex: typeof payload.spinIndex === "number" ? payload.spinIndex : 0,
    spinType: readTitanHistorySpinType(payload.spinType),
    stepIndex: typeof payload.stepIndex === "number" ? payload.stepIndex : 0,
    totalStepsInRound: typeof payload.totalStepsInRound === "number" ? payload.totalStepsInRound : 1,
    timestamp: typeof payload.timestamp === "number" ? payload.timestamp : 0,
    bet: readTitanHistoryAmount(payload.bet),
    win: readTitanHistoryAmount(payload.win),
    profit: readTitanHistoryAmount(payload.profit),
    reels,
    winWays,
    ...(jackpot ? { jackpot } : {}),
  };
}

// ---------------------------------------------------------------------------
// JACKPOT_WIN_HISTORY (1505) — client → server, jackpot win records
// ---------------------------------------------------------------------------

export interface TitanJackpotWinRecord {
  date: string;              // "YYYY-MM-DD" in UTC
  amount: number;             // prize amount (double)
  jackpotType: string;        // "GRAND" or "MAJOR"
  playerDisplayName?: string; // winner display name (GDD §10.3)
  isOwn: boolean;             // true when record belongs to requesting player
}

export interface TitanJackpotWinHistoryPayload {
  cmd: string | number;
  c: number;
  items: TitanJackpotWinRecord[];
  count: number;
}

export function isTitanJackpotWinHistoryPayload(
  payload: Record<string, unknown>,
): boolean {
  return hasCmd(payload, "1505") && Array.isArray(payload.items);
}

function parseTitanJackpotWinRecord(
  row: unknown,
): TitanJackpotWinRecord | null {
  if (!isObject(row)) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.date !== "string" || typeof r.jackpotType !== "string") return null;
  return {
    date: r.date,
    amount: typeof r.amount === "number" ? r.amount : Number(r.amount ?? 0),
    jackpotType: r.jackpotType,
    playerDisplayName: typeof r.playerDisplayName === "string" ? r.playerDisplayName : undefined,
    isOwn: Boolean(r.isOwn),
  };
}

export function parseTitanJackpotWinHistoryPayload(
  payload: Record<string, unknown>,
): TitanJackpotWinHistoryPayload {
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const items = rawItems
    .map((row) => parseTitanJackpotWinRecord(row))
    .filter((item): item is TitanJackpotWinRecord => item !== null);
  return {
    cmd: payload.cmd as string | number,
    c: typeof payload.c === "number" ? payload.c : 0,
    items,
    count: typeof payload.count === "number" ? payload.count : items.length,
  };
}

// ---------------------------------------------------------------------------
// POOL_BALANCE_CHANGED (1506) — server → client push (all online players)
// ---------------------------------------------------------------------------

export interface TitanPoolBalanceChanged {
  cmd: 1506;
  c: number;
  /** Pool balance as decimal string (e.g. "10012.50"). */
  grand: string;
  /** Pool balance as decimal string (e.g. "2037.20"). */
  major: string;
}

export function isTitanPoolBalanceChanged(
  payload: Record<string, unknown>,
): boolean {
  return (
    hasCmd(payload, "1506") &&
    typeof payload.grand === "string" &&
    typeof payload.major === "string"
  );
}
