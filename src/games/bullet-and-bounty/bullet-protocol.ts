import { hasCmd, readWireDecimalString } from "../../ws/protocol";

export const BULLET_REEL_HEIGHTS = [3, 4, 4, 4, 3] as const;

export function emptyBulletReels(): string[][] {
  return BULLET_REEL_HEIGHTS.map((height) => Array.from({ length: height }, () => ""));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringMatrix(v: unknown): v is string[][] {
  return (
    Array.isArray(v) &&
    v.every(
      (col) =>
        Array.isArray(col) && col.every((cell) => typeof cell === "string"),
    )
  );
}

/** Pad/trim a reel matrix to 3-4-4-4-3. */
export function normalizeBulletReels(raw: string[][] | undefined | null): string[][] {
  const base = emptyBulletReels();
  if (!raw) return base;
  for (let c = 0; c < BULLET_REEL_HEIGHTS.length; c++) {
    const height = BULLET_REEL_HEIGHTS[c];
    const col = raw[c] ?? [];
    for (let r = 0; r < height; r++) {
      base[c][r] = typeof col[r] === "string" ? col[r] : "";
    }
  }
  return base;
}

export interface BulletSpinPayload {
  cmd: string | number;
  c: number;
  balance: string | null;
  reels: string[][];
  spinWin: string;
  totalWin: string;
  roundId: string;
  roundState: string;
  roundBet: string | null;
  isFinished: boolean;
  freeSpin: BulletFreeSpinState | null;
  winSymbols: string[];
}

export interface BulletFreeSpinState {
  mode: string | null;
  awaitingChoice: boolean;
  choiceOptions: string[];
  spinsLeft: number;
  multiplier: number;
}

/** Reads `state.freeSpin` off any body that carries one (1005 lastRound, 1500/1507 responses). */
export function parseFreeSpinState(state: unknown): BulletFreeSpinState | null {
  if (!isObject(state)) return null;
  const fs = isObject(state.freeSpin) ? state.freeSpin : undefined;
  if (!fs) return null;
  return {
    mode: typeof fs.mode === "string" ? fs.mode : null,
    awaitingChoice: fs.awaitingChoice === true,
    choiceOptions: Array.isArray(fs.choiceOptions)
      ? fs.choiceOptions.filter((m): m is string => typeof m === "string")
      : [],
    spinsLeft: typeof fs.spinsLeft === "number" ? fs.spinsLeft : 0,
    multiplier: typeof fs.multiplier === "number" ? fs.multiplier : 1,
  };
}

/** Round bet + free-spin state from a full round body (1005 lastRound / 1507 response). */
export function parseFreeSpinFromRound(
  raw: Record<string, unknown> | null | undefined,
): { freeSpin: BulletFreeSpinState | null; roundBet: string | null } {
  const round = raw && isObject(raw.round) ? raw.round : undefined;
  const state = raw && isObject(raw.state) ? raw.state : undefined;
  return {
    freeSpin: parseFreeSpinState(state),
    roundBet: readWireDecimalString(round?.betAmount) ?? null,
  };
}

export function isBulletSpinResponse(payload: Record<string, unknown>): boolean {
  if (!hasCmd(payload, "1500")) return false;
  if (typeof payload.c === "number" && payload.c !== 0) return false;
  return isObject(payload.spin) || isObject(payload.round);
}

export function isBulletSpinError(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1500") && payload.c !== 0 && payload.c !== undefined;
}

export function isBulletModeResponse(payload: Record<string, unknown>): boolean {
  if (!hasCmd(payload, "1507")) return false;
  if (typeof payload.c === "number" && payload.c !== 0) return false;
  return true;
}

export function isBulletModeError(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1507") && payload.c !== 0 && payload.c !== undefined;
}

export function isBulletBalanceUpdate(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1501") && typeof payload.balance === "string";
}

export function isBulletSessionTakenOver(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1006");
}

export function formatBulletError(c: number, mgs?: string): string {
  if (mgs && mgs.trim()) return mgs;
  if (c === 1310) return "Round lock busy. Retry spin.";
  return `Error ${c}`;
}

function readReelsFromSpin(spin: Record<string, unknown> | undefined): string[][] {
  if (!spin) return emptyBulletReels();
  if (isStringMatrix(spin.reels)) return normalizeBulletReels(spin.reels);
  // Bullet backend names the matrix `grid` (1500/1005 wire), not `reels`.
  if (isStringMatrix(spin.grid)) return normalizeBulletReels(spin.grid);
  return emptyBulletReels();
}

export function parseBulletSpinPayload(payload: Record<string, unknown>): BulletSpinPayload {
  const spin = isObject(payload.spin) ? payload.spin : undefined;
  const round = isObject(payload.round) ? payload.round : undefined;
  const spinState = isObject(payload.state) ? payload.state : undefined;
  const winRaw = spin?.win ?? spin?.winAmount ?? round?.totalWin;
  const totalRaw = round?.totalWin ?? winRaw;
  const steps = Array.isArray(spin?.steps) ? spin.steps : [];
  const winSymbols = [
    ...new Set(
      steps.flatMap(
        (step: unknown): string[] =>
          isObject(step) && Array.isArray(step.wins)
            ? step.wins
                .map((w: unknown) => (isObject(w) && typeof w.symbol === "string" ? w.symbol : ""))
                .filter(Boolean)
            : [],
      ),
    ),
  ];
  return {
    cmd: payload.cmd as string | number,
    c: typeof payload.c === "number" ? payload.c : 0,
    balance: readWireDecimalString(payload.balance) ?? null,
    reels: readReelsFromSpin(spin),
    spinWin: readWireDecimalString(winRaw) ?? "0.0000",
    totalWin: readWireDecimalString(totalRaw) ?? "0.0000",
    roundId: typeof round?.roundId === "string" ? round.roundId : "",
    roundState: typeof round?.state === "string" ? round.state : "",
    roundBet: readWireDecimalString(round?.betAmount) ?? null,
    isFinished: round?.isFinished !== false && round?.state !== "ACTIVE" && round?.state !== "RESPIN",
    freeSpin: parseFreeSpinState(spinState),
    winSymbols,
  };
}

export function parseReelsFromLastRound(lastRound: Record<string, unknown> | null): string[][] {
  if (!lastRound) return emptyBulletReels();
  const spin = isObject(lastRound.spin) ? lastRound.spin : undefined;
  return readReelsFromSpin(spin);
}
