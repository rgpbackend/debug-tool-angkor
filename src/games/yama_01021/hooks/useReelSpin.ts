import { useCallback, useEffect, useRef, useState } from "react";
import {
  REEL_SPIN, createSpinLoopSegment, smoothstep01, easeInOutSine,
  type ReelVisualState,
} from "../lib/reel-spin";
import { GRID_REELS } from "../lib/paylines";

const CELL_H = 68;
const GAP = 6;
const CELL_STEP = CELL_H + GAP; // 74px

export interface ReelStripData {
  /** All symbols in the strip (top to bottom in DOM). */
  symbols: string[];
  /** Strip index where the new result starts. Always 0. */
  newResultStart: number;
  /** Strip index where the previous result starts. */
  prevResultStart: number;
  /** Strip index where the loop band starts. */
  loopStart: number;
  /** Length of one loop segment in cells. */
  loopLen: number;
}

export function buildReelStrip(prevResult: string[], newResult: string[]): ReelStripData {
  const loop = createSpinLoopSegment();
  const tailLen = REEL_SPIN.tailLength;
  const tail: string[] = [];
  for (let i = 0; i < tailLen; i++) tail.push(loop[i % loop.length]!);

  return {
    symbols: [...newResult, ...loop, ...loop, ...prevResult, ...tail],
    newResultStart: 0,
    prevResultStart: newResult.length + loop.length * 2,
    loopStart: newResult.length,
    loopLen: loop.length,
  };
}

export function useReelSpin() {
  const [reelStates, setReelStates] = useState<ReelVisualState[]>(() =>
    Array.from({ length: GRID_REELS }, () => "idle"),
  );
  const [bouncingReel, setBouncingReel] = useState<number | null>(null);

  const stripsRef = useRef<(ReelStripData | null)[]>(Array.from({ length: GRID_REELS }, () => null));
  const offsetsRef = useRef<number[]>(Array.from({ length: GRID_REELS }, () => 0));
  const rafRef = useRef(0);
  const spinStartRef = useRef(0);
  const stoppedRef = useRef(new Set<number>());
  const bounceTimerRef = useRef<number | null>(null);

  const applyOffset = useCallback((reelIndex: number, px: number) => {
    const el = document.querySelector(`[data-reel="${reelIndex}"] .titan-reel-strip`) as HTMLElement | null;
    if (el) el.style.transform = `translate3d(0, ${-px}px, 0)`;
    offsetsRef.current[reelIndex] = px;
  }, []);

  const beginSpin = useCallback((prevGrid: string[][]) => {
    stoppedRef.current.clear();
    spinStartRef.current = performance.now();
    setBouncingReel(null);

    const newStrips: (ReelStripData | null)[] = [];
    for (let r = 0; r < GRID_REELS; r++) {
      const prev = [prevGrid[r]?.[0] ?? "?", prevGrid[r]?.[1] ?? "?", prevGrid[r]?.[2] ?? "?"];
      const strip = buildReelStrip(prev, prev); // placeholder result = same as prev for spin phase
      newStrips.push(strip);
      stripsRef.current[r] = strip;
      offsetsRef.current[r] = strip.prevResultStart * CELL_STEP;
      applyOffset(r, offsetsRef.current[r]);
    }

    setReelStates(Array.from({ length: GRID_REELS }, () => "spinning"));

    let last = spinStartRef.current;
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;

      const rampT = (now - spinStartRef.current) / Math.max(1, REEL_SPIN.spinRampUpMs);
      const speed = REEL_SPIN.spinCruiseSpeedPxPerSec * smoothstep01(rampT);

      for (let r = 0; r < GRID_REELS; r++) {
        const strip = stripsRef.current[r];
        if (!strip) continue;

        let offset = offsetsRef.current[r] - speed * dt;
        // Wrap within loop band
        const loopLow = strip.loopStart * CELL_STEP;
        const loopSpan = strip.loopLen * CELL_STEP;
        if (offset < loopLow) {
          const below = loopLow - offset;
          offset = loopLow + loopSpan - (below % loopSpan);
        }
        offsetsRef.current[r] = offset;
        applyOffset(r, offset);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [applyOffset]);

  const stopReels = useCallback((resultGrid: string[][]) => {
    cancelAnimationFrame(rafRef.current);

    // Rebuild strips with actual result
    for (let r = 0; r < GRID_REELS; r++) {
      const oldStrip = stripsRef.current[r];
      const prev = oldStrip
        ? [oldStrip.symbols[oldStrip.prevResultStart] ?? "?", oldStrip.symbols[oldStrip.prevResultStart + 1] ?? "?", oldStrip.symbols[oldStrip.prevResultStart + 2] ?? "?"]
        : ["?", "?", "?"];
      const result = [resultGrid[r]?.[0] ?? "?", resultGrid[r]?.[1] ?? "?", resultGrid[r]?.[2] ?? "?"];
      stripsRef.current[r] = buildReelStrip(prev, result);
    }

    // Schedule stop per reel with staggered delay
    for (let r = 0; r < GRID_REELS; r++) {
      const strip = stripsRef.current[r];
      if (!strip) continue;
      const targetPx = strip.newResultStart * CELL_STEP;
      const startPx = offsetsRef.current[r];
      const cellStep = CELL_STEP;

      // Calculate distance to travel via deceleration
      let dist = startPx - targetPx;
      if (dist < cellStep) dist += strip.loopLen * cellStep; // ensure minimum travel

      const delay = r * REEL_SPIN.stopIntervalMs;
      const duration = REEL_SPIN.stopDurationMs;

      window.setTimeout(() => {
        setReelStates(prev => {
          if (prev[r] !== "spinning") return prev;
          const next = [...prev];
          next[r] = "stopping";
          return next;
        });

        const decelStart = performance.now();
        const tickDecel = (now: number) => {
          const t = Math.min(1, (now - decelStart) / duration);
          const eased = easeInOutSine(t);
          const current = startPx - dist * eased;
          applyOffset(r, current);
          offsetsRef.current[r] = current;

          if (t < 1) {
            requestAnimationFrame(tickDecel);
          } else {
            applyOffset(r, targetPx);
            offsetsRef.current[r] = targetPx;
            stoppedRef.current.add(r);
            setReelStates(prev => {
              const next = [...prev];
              next[r] = "stopped";
              return next;
            });
            // Bounce
            setBouncingReel(r);
            if (bounceTimerRef.current != null) window.clearTimeout(bounceTimerRef.current);
            bounceTimerRef.current = window.setTimeout(() => setBouncingReel(null), REEL_SPIN.bounceMs);
          }
        };
        requestAnimationFrame(tickDecel);
      }, delay);
    }
  }, [applyOffset]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (bounceTimerRef.current != null) window.clearTimeout(bounceTimerRef.current);
  }, []);

  return { reelStates, bouncingReel, stripsRef, beginSpin, stopReels, applyOffset };
}
