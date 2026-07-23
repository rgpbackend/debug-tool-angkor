/**
 * Titan's Wrath — protocol types, parsers, and matchers.
 * Only CMD 1005 (JOIN) and 1500 (SPIN) are defined here.
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
  1305: "Session expired. Reconnecting…",
  1307: "Insufficient balance. Deposit to continue.",
  1308: "Round not found. Starting new round.",
  1309: "Round already ended. Spin again.",
  1310: "Spin in progress. Please wait…",
  1311: "Invalid bet amount.",
  1312: "Session out of sync. Reconnecting…",
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
// Combo threshold helper
// ---------------------------------------------------------------------------

export function getComboLevel(count: number): "COMBO" | "SUPER_COMBO" | "MEGA_COMBO" | null {
  if (count >= 6) return "MEGA_COMBO";
  if (count >= 4) return "SUPER_COMBO";
  if (count >= 2) return "COMBO";
  return null;
}
