/**
 * Titan-specific protocol types and utilities.
 * Moved out of shared ws/ to keep game flows isolated.
 */

// ---------------------------------------------------------------------------
// Titan spin response types (cmd 1500)
// ---------------------------------------------------------------------------

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
    /** Flat 15-char grid string (row-major: first 5 = top row, next 5 = middle, last 5 = bottom). */
    patternGrid: string;
    winAmount: number;
    paylineWins: TitanPaylineWin[];
    superBet?: boolean;
    titanWild?: {
      triggered: boolean;
      wildReels: number[];
    };
  };
  round: {
    roundId: string;
    state: "ACTIVE" | "RESPIN" | "ENDED";
    totalWin: number;
    isEnded: boolean;
  };
  state: {
    isLastSpin: boolean;
    respin?: {
      active: boolean;
      spinCount: number;
      lockedReels: number[];
    };
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
