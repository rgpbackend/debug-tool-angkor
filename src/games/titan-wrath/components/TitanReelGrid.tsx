import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePatternGrid } from "../titan-protocol";
import {
  REEL_SPIN,
  createSpinLoopSegment,
  initialReelStates,
  placeholderResult,
  spinningReelStates,
  type ReelVisualState,
} from "../lib/reel-spin";
import TitanReelColumn from "./TitanReelColumn";

const REEL_COUNT = 5;
const ROWS = 3;

interface TitanReelGridProps {
  patternGrid: string;
  lockedReels: number[];
  spinning: boolean;
  onPresentationChange?: (active: boolean) => void;
}

export default function TitanReelGrid({
  patternGrid,
  lockedReels,
  spinning,
  onPresentationChange,
}: TitanReelGridProps) {
  const reels = useMemo(() => parsePatternGrid(patternGrid), [patternGrid]);

  const [reelStates, setReelStates] = useState<ReelVisualState[]>(() =>
    initialReelStates(REEL_COUNT),
  );
  const [loopSegments, setLoopSegments] = useState<string[][]>([]);
  const [placeholderResults, setPlaceholderResults] = useState<string[][]>([]);
  const [spinOriginReels, setSpinOriginReels] = useState<string[][]>([]);
  const [bouncingReel, setBouncingReel] = useState<number | null>(null);

  const spinStartRef = useRef(0);
  const spinCycleRef = useRef(false);
  const stopScheduledRef = useRef(false);
  const stoppedReelsRef = useRef<Set<number>>(new Set());
  const stopTimersRef = useRef<number[]>([]);
  const bounceTimerRef = useRef<number | null>(null);
  const prevSpinningRef = useRef(spinning);

  const lockedSet = useMemo(() => new Set(lockedReels), [lockedReels]);

  const clearStopTimers = useCallback(() => {
    stopTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    stopTimersRef.current = [];
  }, []);

  // Use a ref for the presentation callback to avoid it being a dependency
  const onPresentationChangeRef = useRef(onPresentationChange);
  onPresentationChangeRef.current = onPresentationChange;

  const finishPresentation = useCallback(() => {
    if (!spinCycleRef.current) return;
    clearStopTimers();
    spinCycleRef.current = false;
    stopScheduledRef.current = false;
    stoppedReelsRef.current.clear();
    onPresentationChangeRef.current?.(false);
  }, [clearStopTimers]);

  // Start spinning
  useEffect(() => {
    if (spinning && !prevSpinningRef.current) {
      clearStopTimers();
      spinCycleRef.current = true;
      stopScheduledRef.current = false;
      stoppedReelsRef.current.clear();
      spinStartRef.current = Date.now();
      onPresentationChangeRef.current?.(true);

      // Locked reels stay idle — only spin unlocked ones
      const states = spinningReelStates(REEL_COUNT);
      for (const ci of lockedReels) {
        states[ci] = "idle";
      }
      setReelStates(states);

      // Record origin from current reels
      setSpinOriginReels(
        Array.from({ length: REEL_COUNT }, (_, ci) => {
          const col = reels[ci] ?? [];
          return Array.from({ length: ROWS }, (_, ri) => col[ri] ?? "");
        }),
      );
      setLoopSegments(
        Array.from({ length: REEL_COUNT }, () => createSpinLoopSegment()),
      );
      setPlaceholderResults(
        Array.from({ length: REEL_COUNT }, () => placeholderResult(ROWS)),
      );
      setBouncingReel(null);
    }
    prevSpinningRef.current = spinning;
  }, [spinning, lockedReels, reels, clearStopTimers]);

  // Schedule reel stops when spinning ends (response arrived).
  // Uses refs for callbacks to avoid clearing timers on unrelated re-renders.
  const finishPresentationRef = useRef(finishPresentation);
  finishPresentationRef.current = finishPresentation;
  const lockedSetRef = useRef(lockedSet);
  lockedSetRef.current = lockedSet;

  useEffect(() => {
    if (spinning || !spinCycleRef.current || stopScheduledRef.current) return;

    stopScheduledRef.current = true;
    const elapsed = Date.now() - spinStartRef.current;
    const delayBeforeStop = Math.max(0, REEL_SPIN.minSpinMs - elapsed);

    const scheduleStop = window.setTimeout(() => {
      let stopSlot = 0;
      for (let ci = 0; ci < REEL_COUNT; ci++) {
        if (lockedSetRef.current.has(ci)) continue;
        const timer = window.setTimeout(() => {
          setReelStates((prev) => {
            if (prev[ci] !== "spinning") return prev;
            const next = [...prev];
            next[ci] = "stopping";
            return next;
          });
        }, stopSlot * REEL_SPIN.stopIntervalMs);
        stopTimersRef.current.push(timer);
        stopSlot++;
      }
    }, delayBeforeStop);
    stopTimersRef.current.push(scheduleStop);

    // Fallback timer: all reels stopped
    const fallbackMs =
      delayBeforeStop +
      (REEL_COUNT - 1) * REEL_SPIN.stopIntervalMs +
      REEL_SPIN.stopDurationMs +
      REEL_SPIN.bounceMs +
      120;
    const fallback = window.setTimeout(() => {
      if (!spinCycleRef.current) return;
      setReelStates(Array.from({ length: REEL_COUNT }, () => "stopped"));
      finishPresentationRef.current();
    }, fallbackMs);
    stopTimersRef.current.push(fallback);
  }, [spinning, reels]); // Only re-trigger when spinning or reels actually change

  // Cleanup
  useEffect(() => () => {
    clearStopTimers();
    if (bounceTimerRef.current != null) window.clearTimeout(bounceTimerRef.current);
  }, [clearStopTimers]);

  // Handle individual reel stopped
  const handleReelStoppedRef = useRef<(ci: number) => void>();
  handleReelStoppedRef.current = (ci: number) => {
    if (stoppedReelsRef.current.has(ci)) return;
    stoppedReelsRef.current.add(ci);

    setReelStates((prev) => {
      if (prev[ci] === "stopped") return prev;
      const next = [...prev];
      next[ci] = "stopped";
      return next;
    });

    setBouncingReel(ci);
    if (bounceTimerRef.current != null) window.clearTimeout(bounceTimerRef.current);
    bounceTimerRef.current = window.setTimeout(() => {
      setBouncingReel(null);
      bounceTimerRef.current = null;
    }, REEL_SPIN.bounceMs);

    const activeReelCount = REEL_COUNT - lockedReels.length;
    const stoppedCount = [...stoppedReelsRef.current].filter(
      (c) => !lockedSet.has(c),
    ).length;
    if (stoppedCount >= activeReelCount) {
      finishPresentationRef.current();
    }
  };

  const handleReelStopped = useCallback((ci: number) => {
    handleReelStoppedRef.current?.(ci);
  }, []);

  return (
    <div className="titan-reel-grid" data-spinning={spinning ? "" : undefined}>
      {Array.from({ length: REEL_COUNT }, (_, ci) => {
        const column = reels[ci] ?? [];
        const originColumn =
          spinOriginReels[ci] ??
          Array.from({ length: ROWS }, (_, ri) => column[ri] ?? "");
        const isLocked = lockedSet.has(ci);

        return (
          <TitanReelColumn
            key={`reel-${ci}`}
            reelIndex={ci}
            colLen={ROWS}
            originColumn={originColumn}
            column={column}
            loopSegment={loopSegments[ci] ?? []}
            motionResult={placeholderResults[ci] ?? []}
            reelState={isLocked ? "idle" : reelStates[ci]}
            bouncing={bouncingReel === ci}
            locked={isLocked}
            onReelStopped={handleReelStopped}
          />
        );
      })}
    </div>
  );
}
