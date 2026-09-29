import { hasCmd, readWireDecimalString } from "../../ws/protocol";

export const ALCHEMY_GRID_SIZE = 8;

/** Engine cascade cap — stop auto-replay before looping forever. */
export const ALCHEMY_STEP_CAP = 64;

export const ALCHEMY_MARK_COLORS = ["BLUE", "PINK", "BROWN", "RED", "GREEN"] as const;

export type AlchemyMarkColor = (typeof ALCHEMY_MARK_COLORS)[number];

export const ALCHEMY_MARK_META: Record<AlchemyMarkColor, { label: string; css: string }> = {
  BLUE: { label: "Purge", css: "blue" },
  PINK: { label: "Transmute", css: "pink" },
  BROWN: { label: "Crystallize", css: "brown" },
  RED: { label: "Summon", css: "red" },
  GREEN: { label: "Potion Splash", css: "green" },
};

export function emptyAlchemyGrid(): string[][] {
  return Array.from({ length: ALCHEMY_GRID_SIZE }, () =>
    Array.from({ length: ALCHEMY_GRID_SIZE }, () => ""),
  );
}

export function emptyGoldenGrid(): boolean[][] {
  return Array.from({ length: ALCHEMY_GRID_SIZE }, () =>
    Array.from({ length: ALCHEMY_GRID_SIZE }, () => false),
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringMatrix(v: unknown): v is string[][] {
  return (
    Array.isArray(v) &&
    v.every(
      (col) => Array.isArray(col) && col.every((cell) => typeof cell === "string" || cell == null),
    )
  );
}

/** Pad/trim a column-major matrix to 8×8. Null cells become empty strings. */
function isBooleanMatrix(v: unknown): v is boolean[][] {
  return (
    Array.isArray(v) &&
    v.every(
      (col) => Array.isArray(col) && col.every((cell) => typeof cell === "boolean" || cell == null),
    )
  );
}

/** Pad/trim golden-spot flags to 8×8. Missing cells are not the spot. */
export function normalizeGoldenGrid(raw: boolean[][] | undefined | null): boolean[][] {
  const base = emptyGoldenGrid();
  if (!raw) return base;
  for (let c = 0; c < ALCHEMY_GRID_SIZE; c++) {
    const col = raw[c] ?? [];
    for (let r = 0; r < ALCHEMY_GRID_SIZE; r++) {
      base[c][r] = col[r] === true;
    }
  }
  return base;
}

export function normalizeAlchemyGrid(raw: string[][] | undefined | null): string[][] {
  const base = emptyAlchemyGrid();
  if (!raw) return base;
  for (let c = 0; c < ALCHEMY_GRID_SIZE; c++) {
    const col = raw[c] ?? [];
    for (let r = 0; r < ALCHEMY_GRID_SIZE; r++) {
      const cell = col[r];
      base[c][r] = typeof cell === "string" ? cell : "";
    }
  }
  return base;
}

export function isAlchemyMarkColor(value: string): value is AlchemyMarkColor {
  return (ALCHEMY_MARK_COLORS as readonly string[]).includes(value);
}

export interface AlchemyWinCell {
  column: number;
  row: number;
}

export interface AlchemyClusterWin {
  symbol: string;
  count: number;
  payoutMultiplier: string;
  winAmount: string;
  cells: AlchemyWinCell[];
}

export interface AlchemyFever {
  active: boolean;
  level: number;
  collected: number;
  target: number | null;
  multiplier: string;
  clearLowSymbols: string;
  doubleWild: boolean;
}

/** Meter before any step has arrived. Target 114 is the base Gold Fever threshold. */
export function inactiveAlchemyFever(): AlchemyFever {
  return {
    active: false,
    level: 0,
    collected: 0,
    target: 114,
    multiplier: "1",
    clearLowSymbols: "INACTIVE",
    doubleWild: false,
  };
}

export interface AlchemySpinPayload {
  cmd: string | number;
  c: number;
  balance: string | null;
  grid: string[][];
  marks: string[][];
  golden: boolean[][];
  wins: AlchemyClusterWin[];
  spinType: string;
  spinIndex: number;
  winAmount: string;
  totalWin: string;
  winCapped: boolean;
  goldenMultiplier: string;
  fever: AlchemyFever;
  roundId: string;
  roundStatus: string;
  roundBet: string | null;
  nextAction: string;
}

export function isAlchemySpinResponse(payload: Record<string, unknown>): boolean {
  if (!hasCmd(payload, "1500")) return false;
  if (typeof payload.c === "number" && payload.c !== 0) return false;
  return isObject(payload.spin) || isObject(payload.round);
}

export function isAlchemySpinError(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1500") && payload.c !== 0 && payload.c !== undefined;
}

export function isAlchemyBalanceUpdate(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1501") && typeof payload.balance === "string";
}

export function isAlchemySessionTakenOver(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1006");
}

export function formatAlchemyError(c: number, mgs?: string): string {
  if (mgs && mgs.trim()) return mgs;
  if (c === 1321) return "Cascade step cap reached.";
  if (c === 1310) return "Round lock busy. Retry spin.";
  return `Error ${c}`;
}

function parseWins(raw: unknown): AlchemyClusterWin[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): AlchemyClusterWin[] => {
    if (!isObject(item) || typeof item.symbol !== "string") return [];
    const cells = Array.isArray(item.cells)
      ? item.cells.flatMap((cell): AlchemyWinCell[] => {
          if (!isObject(cell)) return [];
          if (typeof cell.column !== "number" || typeof cell.row !== "number") return [];
          return [{ column: cell.column, row: cell.row }];
        })
      : [];
    return [
      {
        symbol: item.symbol,
        count: typeof item.count === "number" ? item.count : 0,
        payoutMultiplier: readWireDecimalString(item.payoutMultiplier) ?? "0",
        winAmount: readWireDecimalString(item.winAmount) ?? "0",
        cells,
      },
    ];
  });
}

function parseFever(raw: unknown): AlchemyFever {
  if (!isObject(raw)) return inactiveAlchemyFever();
  const multiplier = readWireDecimalString(raw.multiplier);
  return {
    active: raw.active === true,
    level: typeof raw.level === "number" ? raw.level : 0,
    collected: typeof raw.collected === "number" ? raw.collected : 0,
    target: typeof raw.target === "number" ? raw.target : null,
    multiplier: multiplier ?? "1",
    clearLowSymbols:
      typeof raw.clearLowSymbols === "string" ? raw.clearLowSymbols : "INACTIVE",
    doubleWild: raw.doubleWild === true,
  };
}

function firstStep(spin: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!spin || !Array.isArray(spin.steps) || spin.steps.length === 0) return undefined;
  return isObject(spin.steps[0]) ? spin.steps[0] : undefined;
}

/** Parses one 1500 envelope (`spin` / `round` / `state`). Also used for 1005 `lastRound`. */
export function parseAlchemySpinPayload(payload: Record<string, unknown>): AlchemySpinPayload {
  const spin = isObject(payload.spin) ? payload.spin : undefined;
  const round = isObject(payload.round) ? payload.round : undefined;
  const state = isObject(payload.state) ? payload.state : undefined;
  const step = firstStep(spin);
  const gridSource = isStringMatrix(spin?.grid)
    ? spin.grid
    : isStringMatrix(step?.grid)
      ? step.grid
      : undefined;
  const marksSource = isStringMatrix(step?.marks) ? step.marks : undefined;
  const goldenSource = isBooleanMatrix(step?.golden) ? step.golden : undefined;
  return {
    cmd: payload.cmd as string | number,
    c: typeof payload.c === "number" ? payload.c : 0,
    balance: readWireDecimalString(payload.balance) ?? null,
    grid: normalizeAlchemyGrid(gridSource),
    marks: normalizeAlchemyGrid(marksSource),
    golden: normalizeGoldenGrid(goldenSource),
    wins: parseWins(step?.wins),
    spinType: typeof spin?.spinType === "string" ? spin.spinType : "",
    spinIndex: typeof spin?.spinIndex === "number" ? spin.spinIndex : 0,
    winAmount: readWireDecimalString(spin?.winAmount) ?? "0",
    totalWin: readWireDecimalString(round?.totalWin) ?? "0",
    winCapped: spin?.winCapped === true,
    goldenMultiplier: readWireDecimalString(spin?.goldenMultiplier) ?? "1",
    fever: parseFever(state?.fever),
    roundId: typeof round?.roundId === "string" ? round.roundId : "",
    roundStatus: typeof round?.status === "string" ? round.status : "",
    roundBet: readWireDecimalString(round?.betAmount) ?? null,
    nextAction: typeof state?.nextAction === "string" ? state.nextAction : "DONE",
  };
}

export function parseAlchemyFromLastRound(
  lastRound: Record<string, unknown> | null,
): AlchemySpinPayload | null {
  if (!lastRound) return null;
  if (!isObject(lastRound.spin) && !isObject(lastRound.round)) return null;
  return parseAlchemySpinPayload(lastRound);
}
