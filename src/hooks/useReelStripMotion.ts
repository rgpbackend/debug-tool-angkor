import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  REEL_SPIN,
  easeInOutSine,
  smoothstep01,
  type ReelVisualState,
  type UnifiedReelStrip,
} from "../lib/reel-spin";

type UseReelStripMotionArgs = {
  reelState: ReelVisualState;
  strip: UnifiedReelStrip;
  onStopped: () => void;
};

/**
 * `offsetPx` = distance from the top of the strip to the top of the viewport.
 *
 * Render uses `translateY(-offsetPx)`:
 *   • Decreasing `offsetPx` → strip slides DOWN in pixels → symbols inside the
 *     viewport scroll top → bottom (consistent for both spin loop and decel).
 *   • Spin starts at `previousResultStartIndex` (bottom of strip) and decels
 *     to `newResultStartIndex` (top of strip).
 */

function measureCellStep(stripEl: HTMLElement): number {
  const cells = stripEl.querySelectorAll<HTMLElement>(".cell");
  if (cells.length >= 2) {
    return cells[1].offsetTop - cells[0].offsetTop;
  }
  return cells[0]?.offsetHeight ?? 0;
}

function wrapLoopOffset(
  offsetPx: number,
  loopBandLowPx: number,
  loopSpanPx: number,
): number {
  if (offsetPx >= loopBandLowPx) {
    return offsetPx;
  }
  const below = loopBandLowPx - offsetPx;
  return loopBandLowPx + loopSpanPx - (below % loopSpanPx);
}

export function useReelStripMotion({
  reelState,
  strip,
  onStopped,
}: UseReelStripMotionArgs) {
  const stripRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);
  const cellStepRef = useRef(0);
  const onStoppedRef = useRef(onStopped);
  onStoppedRef.current = onStopped;

  const applyOffset = useCallback((offsetPx: number) => {
    const el = stripRef.current;
    if (!el) {
      return;
    }
    const snapped =
      Math.round(offsetPx * devicePixelRatio) / devicePixelRatio;
    el.style.transform = `translate3d(0, ${-snapped}px, 0)`;
  }, []);

  useLayoutEffect(() => {
    if (reelState !== "spinning" && reelState !== "stopping") {
      return;
    }
    const el = stripRef.current;
    if (!el) {
      return;
    }
    const step = measureCellStep(el);
    if (step > 0) {
      cellStepRef.current = step;
    }
  }, [reelState, strip.symbols]);

  useLayoutEffect(() => {
    if (reelState !== "spinning") {
      return;
    }
    const el = stripRef.current;
    if (!el) {
      return;
    }
    const step = measureCellStep(el);
    if (step > 0) {
      cellStepRef.current = step;
    }
    const initialOffset = strip.previousResultStartIndex * cellStepRef.current;
    offsetRef.current = initialOffset;
    applyOffset(initialOffset);
  }, [reelState, strip.previousResultStartIndex, strip.symbols, applyOffset]);

  useEffect(() => {
    if (reelState !== "spinning" && reelState !== "stopping") {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reelState === "spinning") {
      const spinPhaseStart = performance.now();
      let last = spinPhaseStart;

      const tick = (now: number) => {
        const el = stripRef.current;
        if (!el) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (cellStepRef.current <= 0) {
          cellStepRef.current = measureCellStep(el);
        }
        const step = cellStepRef.current;
        if (step <= 0) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const loopBandLowPx = strip.loopBandStartIndex * step;
        const loopSpanPx = strip.loopSegmentLength * step;
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;

        const rampT =
          (now - spinPhaseStart) / Math.max(1, REEL_SPIN.spinRampUpMs);
        const speedPxPerSec =
          REEL_SPIN.spinCruiseSpeedPxPerSec * smoothstep01(rampT);

        const next = offsetRef.current - speedPxPerSec * dt;
        offsetRef.current = wrapLoopOffset(next, loopBandLowPx, loopSpanPx);
        applyOffset(offsetRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }

    cancelAnimationFrame(rafRef.current);

    const el = stripRef.current;
    if (!el) {
      onStoppedRef.current();
      return;
    }

    if (cellStepRef.current <= 0) {
      cellStepRef.current = measureCellStep(el);
    }

    const step = cellStepRef.current;
    const targetPx = strip.newResultStartIndex * step;

    if (step <= 0 || reducedMotion) {
      offsetRef.current = targetPx;
      applyOffset(targetPx);
      onStoppedRef.current();
      return;
    }

    const loopSpanPx = strip.loopSegmentLength * step;
    const startPx = offsetRef.current;
    let distancePx = startPx - targetPx;
    if (distancePx < step) {
      distancePx = step + loopSpanPx;
    }

    const duration = REEL_SPIN.stopDurationMs;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeInOutSine(t);
      const current = startPx - distancePx * eased;
      offsetRef.current = current;
      applyOffset(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        offsetRef.current = targetPx;
        applyOffset(targetPx);
        onStoppedRef.current();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reelState, strip, applyOffset]);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return stripRef;
}
