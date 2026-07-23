import { useCallback, useEffect, useRef, useState } from "react";

export type SpinPhase =
  | "idle"
  | "spinning"
  | "reveal"
  | "wild_expand"
  | "paylines"
  | "result";

const PHASE_TIMINGS: Record<Exclude<SpinPhase, "idle" | "spinning">, number> = {
  reveal: 400,
  wild_expand: 1200,
  paylines: 1200,
  result: 1500,
};

interface UseSpinPhaseArgs {
  /** Increments each time a new spin starts (triggers SPINNING → reveal → ...) */
  spinTick: number;
  /** True when the spin response has wild expansion */
  hasWild: boolean;
  /** True when there are winning paylines */
  hasPaylineWins: boolean;
  /** True once the WS spin response arrives (isSpinning from session goes false) */
  spinResponseReady: boolean;
}

export function useSpinPhase({
  spinTick,
  hasWild,
  hasPaylineWins,
  spinResponseReady,
}: UseSpinPhaseArgs): SpinPhase {
  const [phase, setPhase] = useState<SpinPhase>("idle");
  const timerRef = useRef<number | null>(null);
  const spinTickRef = useRef(spinTick);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // When spinTick increments → start SPINNING
  useEffect(() => {
    if (spinTick !== spinTickRef.current) {
      spinTickRef.current = spinTick;
      clearTimer();
      setPhase("spinning");
    }
  }, [spinTick, clearTimer]);

  // When spinResponseReady becomes true (response arrived) → move to REVEAL
  useEffect(() => {
    if (spinResponseReady && phase === "spinning") {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setPhase("reveal");
      }, 200); // brief pause after reels stop
    }
    return clearTimer;
  }, [spinResponseReady, phase, clearTimer]);

  // Phase transitions — each phase sets a timer to advance to the next
  useEffect(() => {
    if (phase === "idle" || phase === "spinning") return;

    clearTimer();

    const next = nextPhase(phase, { hasWild, hasPaylineWins });
    const delay = PHASE_TIMINGS[phase];

    timerRef.current = window.setTimeout(() => {
      setPhase(next);
    }, delay);

    return clearTimer;
  }, [phase, hasWild, hasPaylineWins, clearTimer]);

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  return phase;
}

function nextPhase(
  current: Exclude<SpinPhase, "idle" | "spinning">,
  flags: { hasWild: boolean; hasPaylineWins: boolean },
): SpinPhase {
  switch (current) {
    case "reveal":
      return flags.hasWild ? "wild_expand" : flags.hasPaylineWins ? "paylines" : "result";
    case "wild_expand":
      return flags.hasPaylineWins ? "paylines" : "result";
    case "paylines":
      return "result";
    case "result":
      return "idle";
    default:
      return "idle";
  }
}
