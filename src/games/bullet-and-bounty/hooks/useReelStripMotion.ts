import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useSyncRef } from "../../../hooks/useSyncRef";
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
 * Render uses `translateY(-offsetPx)`: decreasing `offsetPx` scrolls symbols
 * top → bottom inside the viewport (spin loop and landing decel both).
 * Ported from the Angkor game's hook of the same name.
 */
function measureCellStep(stripEl: HTMLElement): number {
  const cells = stripEl.querySelectorAll<HTMLElement>(".bullet-cell");
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
  // Cruise phase start survives effect re-runs (strip content swaps when the
  // result arrives mid-cruise) so the ramp-up does not restart — a restart
  // would read as a visible slow-down pulse right before the reel lands.
  const spinPhaseStartRef = useRef(0);
  const onStoppedRef = useRef(onStopped);
  useSyncRef(onStoppedRef, onStopped);

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
      if (spinPhaseStartRef.current === 0) {
        spinPhaseStartRef.current = performance.now();
      }
      const spinPhaseStart = spinPhaseStartRef.current;
      let last = performance.now();

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
    spinPhaseStartRef.current = 0;

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

    // Decel onto the result — angkor's easeInOutSine profile, with two guards
    // against the "fishbone" jerk:
    //   1. clip the start into the loop band (content is periodic there, so
    //      the jump is invisible) — keeps the sweep short;
    //   2. stretch the duration if needed so peak speed stays ≤ ~0.18 cell per
    //      frame — past ~half a cell per frame symbols strobe (wagon-wheel).
    const loopSpanPx = strip.loopSegmentLength * step;
    const bandLowPx = strip.loopBandStartIndex * step;
    let startPx = offsetRef.current;
    if (startPx > bandLowPx + loopSpanPx) {
      startPx = bandLowPx + ((startPx - bandLowPx) % loopSpanPx);
      offsetRef.current = startPx;
      applyOffset(startPx);
    }
    let distancePx = startPx - targetPx;
    if (distancePx < step) {
      distancePx = step + loopSpanPx;
    }

    const peakCapPxPerSec = step * 60 * 0.35;
    const duration = Math.max(
      REEL_SPIN.stopDurationMs,
      (1.571 * distancePx * 1000) / peakCapPxPerSec,
    );
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
