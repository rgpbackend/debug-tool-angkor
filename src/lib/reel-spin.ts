export const REEL_SPIN = {
  /** Minimum time all reels spin before the first column can stop. */
  minSpinMs: 720,
  /** Delay between each reel stop trigger (left → right). */
  stopIntervalMs: 420,
  /** Deceleration duration for a single reel landing. */
  stopDurationMs: 780,
  /** Symbols in one seamless loop segment (duplicated in the strip). */
  loopSegmentLength: 16,
  /** Symbols after the result for decel headroom. */
  tailLength: 4,
  /** Scroll speed while spinning (px/s) — kept moderate to reduce eye strain. */
  spinSpeedPxPerSec: 880,
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
  resultStartIndex: number;
};

export function randomSpinSymbol(): string {
  return SPIN_STRIP_SYMBOLS[
    Math.floor(Math.random() * SPIN_STRIP_SYMBOLS.length)
  ];
}

export function buildSpinStrip(length: number): string[] {
  return Array.from({ length }, () => randomSpinSymbol());
}

/** One strip for both spin and stop — loop segment is reused so motion never jumps. */
export function buildUnifiedReelStrip(
  loopSegment: string[],
  result: string[],
): UnifiedReelStrip {
  const tail = buildSpinStrip(REEL_SPIN.tailLength);
  const loopSegmentLength = loopSegment.length;
  return {
    symbols: [...loopSegment, ...loopSegment, ...result, ...tail],
    loopSegmentLength,
    resultStartIndex: loopSegmentLength * 2,
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

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}
