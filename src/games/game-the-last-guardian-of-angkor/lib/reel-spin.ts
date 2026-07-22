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
  /** Peak scroll speed during the spin loop (px/s) — no sustained “blur” phase. */
  spinCruiseSpeedPxPerSec: 620,
  /** Brief settle after a reel lands. */
  bounceMs: 220,
} as const;

export const SPIN_STRIP_SYMBOLS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "W",
  "S",
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

/**
 * Motion strip layout (top → bottom in DOM):
 *   [ newResult | loopA | loopB | previousResult | tail ]
 *
 * Render once `translateY = -previousResultStartIndex * step` so the viewport
 * starts on the previous result, then animate translateY toward 0 — strip
 * shifts downward in pixels, which scrolls symbols top → bottom inside the
 * viewport for both the spinning loop and the landing decel.
 */
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
    newResultStartIndex: 0,
    loopBandStartIndex: newLen,
    previousResultStartIndex: newLen + loopLen * 2,
  };
}

export function createSpinLoopSegment(): string[] {
  return buildSpinStrip(REEL_SPIN.loopSegmentLength);
}

export function placeholderResult(colLen: number): string[] {
  return buildSpinStrip(colLen);
}

export function initialReelStates(count: number): ReelVisualState[] {
  return Array.from({ length: count }, () => "idle");
}

export function spinningReelStates(count: number): ReelVisualState[] {
  return Array.from({ length: count }, () => "spinning");
}

/** Smooth 0→1 ramp (no abrupt jerk at start/end). */
export function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Gentle landing — slow in and slow out (avoids a fast “whip” at decel start). */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * Math.max(0, Math.min(1, t))) - 1) / 2;
}
