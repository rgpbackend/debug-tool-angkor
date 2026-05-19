import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  REEL_SPIN,
  easeOutCubic,
  type ReelVisualState,
  type UnifiedReelStrip,
} from "../lib/reel-spin";

type UseReelStripMotionArgs = {
  reelState: ReelVisualState;
  strip: UnifiedReelStrip;
  onStopped: () => void;
};

function measureCellStep(stripEl: HTMLElement): number {
  const cells = stripEl.querySelectorAll<HTMLElement>(".cell");
  if (cells.length >= 2) {
    return cells[1].offsetTop - cells[0].offsetTop;
  }
  return cells[0]?.offsetHeight ?? 0;
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

  const applyOffset = useCallback((offset: number) => {
    const el = stripRef.current;
    if (!el) {
      return;
    }
    const snapped =
      Math.round(offset * devicePixelRatio) / devicePixelRatio;
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

  useEffect(() => {
    if (reelState === "spinning") {
      offsetRef.current = 0;
      applyOffset(0);
    }
  }, [reelState, strip.loopSegmentLength, applyOffset]);

  useEffect(() => {
    if (reelState !== "spinning" && reelState !== "stopping") {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reelState === "spinning") {
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

        const loopLen = strip.loopSegmentLength * step;
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        offsetRef.current =
          (offsetRef.current + REEL_SPIN.spinSpeedPxPerSec * dt) % loopLen;
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
    if (step <= 0 || reducedMotion) {
      const target = strip.resultStartIndex * (step || 1);
      offsetRef.current = target;
      applyOffset(target);
      onStoppedRef.current();
      return;
    }

    const target = strip.resultStartIndex * step;
    const start = offsetRef.current;
    const distance = Math.max(step, target - start);
    const duration = REEL_SPIN.stopDurationMs;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(t);
      const current = start + distance * eased;
      offsetRef.current = current;
      applyOffset(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        offsetRef.current = target;
        applyOffset(target);
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
