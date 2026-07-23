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

  const finishPresentation = useCallback(() => {
    if (!spinCycleRef.current) return;
    clearStopTimers();
    spinCycleRef.current = false;
    stopScheduledRef.current = false;
    stoppedReelsRef.current.clear();
    onPresentationChange?.(false);
  }, [clearStopTimers, onPresentationChange]);

  // Start spinning
  useEffect(() => {
    if (spinning && !prevSpinningRef.current) {
      clearStopTimers();
      spinCycleRef.current = true;
      stopScheduledRef.current = false;
      stoppedReelsRef.current.clear();
      spinStartRef.current = Date.now();
      onPresentationChange?.(true);

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
  }, [spinning, lockedReels, reels, clearStopTimers, onPresentationChange]);

  // Schedule reel stops when spinning ends (response arrived)
  useEffect(() => {
    if (spinning || !spinCycleRef.current || stopScheduledRef.current) return;

    stopScheduledRef.current = true;
    const elapsed = Date.now() - spinStartRef.current;
    const delayBeforeStop = Math.max(0, REEL_SPIN.minSpinMs - elapsed);
    clearStopTimers();

    const scheduleStop = window.setTimeout(() => {
      let stopSlot = 0;
      for (let ci = 0; ci < REEL_COUNT; ci++) {
        if (lockedSet.has(ci)) continue; // locked reels don't stop — they never started
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
      finishPresentation();
    }, fallbackMs);
    stopTimersRef.current.push(fallback);

    return clearStopTimers;
  }, [spinning, lockedSet, reels, clearStopTimers, finishPresentation]);

  // Cleanup
  useEffect(() => () => {
    clearStopTimers();
    if (bounceTimerRef.current != null) window.clearTimeout(bounceTimerRef.current);
  }, [clearStopTimers]);

  // Handle individual reel stopped
  const handleReelStopped = useCallback(
    (ci: number) => {
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

      // Count only non-locked reels
      const activeReelCount = REEL_COUNT - lockedReels.length;
      const stoppedCount = [...stoppedReelsRef.current].filter(
        (c) => !lockedSet.has(c),
      ).length;
      if (stoppedCount >= activeReelCount) {
        finishPresentation();
      }
    },
    [lockedReels.length, lockedSet, finishPresentation],
  );

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
