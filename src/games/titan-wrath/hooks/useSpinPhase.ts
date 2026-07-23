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
  spinTick: number;
  hasWild: boolean;
  hasPaylineWins: boolean;
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

  useEffect(() => {
    if (spinTick !== spinTickRef.current) {
      spinTickRef.current = spinTick;
      clearTimer();
      setPhase("spinning");
    }
  }, [spinTick, clearTimer]);

  useEffect(() => {
    if (spinResponseReady && phase === "spinning") {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setPhase("reveal");
      }, 200);
    }
    return clearTimer;
  }, [spinResponseReady, phase, clearTimer]);

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

  useEffect(() => () => clearTimer(), [clearTimer]);

  return phase;
}

function nextPhase(
  current: Exclude<SpinPhase, "idle" | "spinning">,
  flags: { hasWild: boolean; hasPaylineWins: boolean },
): SpinPhase {
  switch (current) {
    case "reveal":
      if (flags.hasPaylineWins) return "paylines";
      if (flags.hasWild) return "wild_expand";
      return "result";
    case "paylines":
      if (flags.hasWild) return "wild_expand";
      return "result";
    case "wild_expand":
      return "result";
    case "result":
      return "idle";
    default:
      return "idle";
  }
}
