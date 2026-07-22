export const REEL_SPIN = {
  minSpinMs: 600,
  stopIntervalMs: 350,
  stopDurationMs: 700,
  loopSegmentLength: 10,
  tailLength: 3,
  spinRampUpMs: 400,
  spinCruiseSpeedPxPerSec: 700,
  bounceMs: 180,
} as const;

export const SPIN_STRIP_SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "W"] as const;

export type ReelVisualState = "idle" | "spinning" | "stopping" | "stopped";

export function randomSpinSymbol(): string {
  return SPIN_STRIP_SYMBOLS[Math.floor(Math.random() * SPIN_STRIP_SYMBOLS.length)];
}

export function buildSpinStrip(length: number): string[] {
  return Array.from({ length }, () => randomSpinSymbol());
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

export function smoothstep01(t: number): number {
  return Math.max(0, Math.min(1, t)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, t)));
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * Math.max(0, Math.min(1, t))) - 1) / 2;
}
