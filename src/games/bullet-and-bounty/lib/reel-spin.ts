/**
 * Reel motion model (ported from the Angkor game's lib/reel-spin — same
 * constants, bullet's own symbol pool). Motion strip layout, top → bottom:
 *   [ newResult | loop | loop | previousResult | tail ]
 * The viewport starts on `previousResult`, cruises within the seamless loop
 * band, then decelerates to `newResult` (offset 0) when the reel stops.
 */
export const REEL_SPIN = {
  /** Minimum time all reels spin before the first column can stop. */
  minSpinMs: 720,
  /** Delay between each reel stop trigger (left → right). */
  stopIntervalMs: 420,
  /** Deceleration duration for a single reel landing. */
  stopDurationMs: 860,
  /** Symbols in one seamless loop segment (duplicated in the strip). */
  loopSegmentLength: 16,
  /** Symbols after the result for decel headroom. */
  tailLength: 4,
  /** Time to ease from rest into cruise spin speed. */
  spinRampUpMs: 480,
  /** Peak scroll speed during the spin loop (px/s). */
  spinCruiseSpeedPxPerSec: 620,
  /** Brief settle after a reel lands. */
  bounceMs: 220,
} as const;

export const SPIN_STRIP_SYMBOLS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "W", "S", "P",
] as const;

export type ReelVisualState = "idle" | "spinning" | "stopping" | "stopped";

export type UnifiedReelStrip = {
  symbols: string[];
  loopSegmentLength: number;
  /** Strip index where the seamless loop band begins (right after newResult). */
  loopBandStartIndex: number;
  /** Strip index where the new (target) result rows begin. Always 0. */
  newResultStartIndex: number;
  /** Strip index where the previous (initial) result rows begin. */
  previousResultStartIndex: number;
};

export function randomSpinSymbol(): string {
  return SPIN_STRIP_SYMBOLS[
    Math.floor(Math.random() * SPIN_STRIP_SYMBOLS.length)
  ];
}

export function buildSpinStrip(length: number): string[] {
  return Array.from({ length }, () => randomSpinSymbol());
}

export function buildUnifiedReelStrip(
  previousResult: string[],
  loopSegment: string[],
  result: string[],
): UnifiedReelStrip {
  const tail = buildSpinStrip(REEL_SPIN.tailLength);
  const loopLen = loopSegment.length;
  const newLen = result.length;
  return {
    symbols: [
      ...result,
      ...loopSegment,
      ...loopSegment,
      ...previousResult,
      ...tail,
    ],
    loopSegmentLength: loopLen,
    // Band starts right after the result (loop copies are identical, so the
    // wrap is seamless) — keeps the decel sweep short like angkor's.
    loopBandStartIndex: newLen,
    newResultStartIndex: 0,
    previousResultStartIndex: newLen + 2 * loopLen,
  };
}

export function easeInOutSine(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

export function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}
