import type { ServerPayline } from "../../../ws/protocol";

export const GRID_REELS = 5;
export const GRID_ROWS = 3;

export type PaylineMatch = {
  paylineIndex: number;
  symbol: string;
  count: number;
  positions: [number, number][];
  direction: "ltr" | "rtl";
};

export type ComboLevel = "none" | "combo" | "super" | "mega";

/** Match 3+ consecutive symbols on a payline (both-ways). */
export function matchOnPayline(
  reels: string[][],
  rows: readonly number[],
): PaylineMatch | null {
  const startSymbol = reels[0]?.[rows[0]];
  if (startSymbol == null || startSymbol === "") return null;

  let ltrCount = 1;
  const ltrPos: [number, number][] = [[0, rows[0]]];
  for (let r = 1; r < GRID_REELS; r++) {
    const row = rows[r];
    const sym = reels[r]?.[row];
    if (sym === startSymbol || sym === "W") { ltrCount++; ltrPos.push([r, row]); }
    else break;
  }

  const endSymbol = reels[4]?.[rows[4]];
  let rtlCount = 1;
  const rtlPos: [number, number][] = [[4, rows[4]]];
  for (let r = 3; r >= 0; r--) {
    const row = rows[r];
    const sym = reels[r]?.[row];
    if (sym === endSymbol || sym === "W") { rtlCount++; rtlPos.push([r, row]); }
    else break;
  }

  if (ltrCount >= 3 && ltrCount >= rtlCount) {
    return { paylineIndex: -1, symbol: startSymbol, count: ltrCount, positions: ltrPos, direction: "ltr" };
  }
  if (rtlCount >= 3) {
    return { paylineIndex: -1, symbol: String(endSymbol ?? ""), count: rtlCount, positions: (rtlPos.reverse() as [number, number][]), direction: "rtl" };
  }
  return null;
}

/** Evaluate all paylines against current reels. Uses server-provided paylines. */
export function evaluateAllPaylines(
  reels: string[][],
  serverPaylines: ServerPayline[],
): { matches: PaylineMatch[]; comboLevel: ComboLevel } {
  const matches: PaylineMatch[] = [];
  for (let i = 0; i < serverPaylines.length; i++) {
    const pl = serverPaylines[i];
    if (!pl || pl.rows.length < GRID_REELS) continue;
    const match = matchOnPayline(reels, pl.rows);
    if (match) matches.push({ ...match, paylineIndex: i });
  }
  const n = matches.length;
  const comboLevel: ComboLevel = n >= 6 ? "mega" : n >= 4 ? "super" : n >= 2 ? "combo" : "none";
  return { matches, comboLevel };
}

/** Only Wilds appear on reels 2, 3, 4 (0-indexed). */
export function expandingWildReels(reels: string[][]): number[] {
  const wildReels: number[] = [];
  for (let r = 1; r <= 3; r++) {
    const col = reels[r];
    if (!col) continue;
    if (col.some((sym) => sym === "W")) wildReels.push(r);
  }
  return wildReels;
}

/** Titan Multiplier: 3-OAK + 1 wild reel = x2, 4-OAK + 1 wild = x2, 4-OAK + 2 wild = x3 */
export function titanMultiplier(matchCount: number, wildReelCount: number): number {
  if (matchCount === 5) return 4;
  if (matchCount === 4 && wildReelCount >= 2) return 3;
  if ((matchCount === 3 || matchCount === 4) && wildReelCount >= 1) return 2;
  return 1;
}
