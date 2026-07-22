import { useCallback, useEffect, useRef, useState } from "react";
import { REEL_SPIN, createSpinLoopSegment } from "../lib/reel-spin";
import { GRID_REELS } from "../lib/paylines";

const CELL_H = 68;
const GAP = 6;
const STEP = CELL_H + GAP;

export type ReelVisualState = "idle" | "spinning" | "stopping" | "stopped";

export function randomPlaceholderGrid(): string[][] {
  return Array.from({ length: GRID_REELS }, () =>
    Array.from({ length: 3 }, () => {
      const syms = ["A", "B", "C", "D", "E", "F", "G"];
      return syms[Math.floor(Math.random() * syms.length)]!;
    }),
  );
}

interface StripEntry {
  symbols: string[];
  loopLen: number;
}

function buildStrip(prevCol: string[], resultCol: string[]): StripEntry {
  const loop = createSpinLoopSegment();
  const tail = [loop[0]!, loop[1]!, loop[2]!];
  return {
    symbols: [...resultCol, ...loop, ...loop, ...prevCol, ...tail],
    loopLen: loop.length,
  };
}

export function useReelSpin() {
  const [state, setState] = useState<ReelVisualState[]>(() =>
    Array.from({ length: GRID_REELS }, () => "idle"),
  );
  const [bouncing, setBouncing] = useState<number | null>(null);
  const [stripSymbols, setStripSymbols] = useState<(string[] | null)[]>(() =>
    Array.from({ length: GRID_REELS }, () => null),
  );

  const stripsRef = useRef<(StripEntry | null)[]>(Array.from({ length: GRID_REELS }, () => null));
  const offsetsRef = useRef<number[]>(Array.from({ length: GRID_REELS }, () => 0));
  const spinRafRef = useRef(0);
  const stopTimersRef = useRef<number[]>([]);

  const applyOffset = useCallback((ri: number, px: number) => {
    offsetsRef.current[ri] = px;
    const el = document.querySelector(`[data-reel="${ri}"] .titan-reel-strip`) as HTMLElement | null;
    if (el) el.style.transform = `translate3d(0, ${-Math.round(px)}px, 0)`;
  }, []);

  const clearTimers = useCallback(() => {
    stopTimersRef.current.forEach(window.clearTimeout);
    stopTimersRef.current = [];
  }, []);

  const beginSpin = useCallback((prevGrid: string[][]) => {
    cancelAnimationFrame(spinRafRef.current);
    clearTimers();
    setBouncing(null);

    // Build strips: prevCol from current grid, placeholder result for spin phase
    const newStrips: (StripEntry | null)[] = [];
    for (let r = 0; r < GRID_REELS; r++) {
      const prev = [prevGrid[r]?.[0] ?? "A", prevGrid[r]?.[1] ?? "B", prevGrid[r]?.[2] ?? "C"];
      const strip = buildStrip(prev, prev); // result = prev during spin (will be replaced on stop)
      newStrips.push(strip);
      stripsRef.current[r] = strip;
      offsetsRef.current[r] = strip.symbols.indexOf(prev[0]!, 2 * strip.loopLen + 3) * STEP;
      // Find prevCol[0] position in the prevCol section of the strip
      const prevStart = 3 + strip.loopLen * 2;
      offsetsRef.current[r] = prevStart * STEP;
      applyOffset(r, offsetsRef.current[r]);
    }

    setStripSymbols(newStrips.map(s => s?.symbols ?? null));
    setState(Array.from({ length: GRID_REELS }, () => "spinning"));

    // Spin loop
    const startTime = performance.now();
    let last = startTime;
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const ramp = Math.min(1, (now - startTime) / REEL_SPIN.spinRampUpMs);
      const speed = REEL_SPIN.spinCruiseSpeedPxPerSec * (ramp * ramp * (3 - 2 * ramp));

      for (let r = 0; r < GRID_REELS; r++) {
        const strip = stripsRef.current[r];
        if (!strip) continue;
        let off = offsetsRef.current[r] - speed * dt;
        const loopLow = (3 + strip.loopLen) * STEP;
        const loopHigh = loopLow + strip.loopLen * STEP;
        if (off < loopLow) off += strip.loopLen * STEP;
        offsetsRef.current[r] = off;
        applyOffset(r, off);
      }
      spinRafRef.current = requestAnimationFrame(tick);
    };
    spinRafRef.current = requestAnimationFrame(tick);
  }, [applyOffset, clearTimers]);

  const stopReels = useCallback((resultGrid: string[][]) => {
    cancelAnimationFrame(spinRafRef.current);
    clearTimers();

    // Rebuild strips with real result
    for (let r = 0; r < GRID_REELS; r++) {
      const old = stripsRef.current[r];
      const prev = old
        ? [old.symbols[old.symbols.length - 6] ?? "A", old.symbols[old.symbols.length - 5] ?? "B", old.symbols[old.symbols.length - 4] ?? "C"]
        : ["A", "B", "C"];
      const result = [resultGrid[r]?.[0] ?? "A", resultGrid[r]?.[1] ?? "B", resultGrid[r]?.[2] ?? "C"];
      stripsRef.current[r] = buildStrip(prev, result);
    }
    setStripSymbols(Array.from({ length: GRID_REELS }, (_, r) => stripsRef.current[r]?.symbols ?? null));

    // Staggered stop per reel
    for (let r = 0; r < GRID_REELS; r++) {
      const timer = window.setTimeout(() => {
        const strip = stripsRef.current[r];
        if (!strip) return;
        const targetPx = 0; // result is at index 0 of the strip
        const startPx = offsetsRef.current[r];
        let dist = startPx - targetPx;
        // ensure at least one full loop of travel
        if (dist < strip.loopLen * STEP * 0.5) dist += strip.loopLen * STEP;

        setState(prev => { const n = [...prev]; n[r] = "stopping"; return n; });

        const decelStart = performance.now();
        const duration = REEL_SPIN.stopDurationMs;
        const tickDecel = (now: number) => {
          const t = Math.min(1, (now - decelStart) / duration);
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
          const current = startPx - dist * eased;
          applyOffset(r, current);
          offsetsRef.current[r] = current;

          if (t < 1) {
            requestAnimationFrame(tickDecel);
          } else {
            applyOffset(r, targetPx);
            offsetsRef.current[r] = targetPx;
            setState(prev => { const n = [...prev]; n[r] = "stopped"; return n; });
            setBouncing(r);
            setTimeout(() => setBouncing(null), REEL_SPIN.bounceMs);
          }
        };
        requestAnimationFrame(tickDecel);
      }, r * REEL_SPIN.stopIntervalMs);
      stopTimersRef.current.push(timer);
    }
  }, [applyOffset, clearTimers]);

  useEffect(() => () => {
    cancelAnimationFrame(spinRafRef.current);
    clearTimers();
  }, [clearTimers]);

  return { reelStates: state, bouncingReel: bouncing, stripSymbols, beginSpin, stopReels };
}
