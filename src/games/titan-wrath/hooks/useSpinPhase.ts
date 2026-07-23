import { useCallback, useEffect, useRef, useState } from "react";

export type SpinPhase =
  | "idle"
  | "spinning"
  | "reveal"
  | "wild_expand"
  | "paylines"
  | "pre_respin"
  | "result";

const PHASE_TIMINGS: Record<Exclude<SpinPhase, "idle" | "spinning">, number> = {
  reveal: 400,
  wild_expand: 1200,
  paylines: 1200,
  pre_respin: 1200,
  result: 1500,
};

interface UseSpinPhaseArgs {
  spinTick: number;
  hasWild: boolean;
  hasPaylineWins: boolean;
  /** True when this spin will be followed by a respin (round.state === "RESPIN") */
  hasRespin: boolean;
  spinResponseReady: boolean;
}

export function useSpinPhase({
  spinTick,
  hasWild,
  hasPaylineWins,
  hasRespin,
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

  // When spinResponseReady → REVEAL
  useEffect(() => {
    if (spinResponseReady && phase === "spinning") {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setPhase("reveal");
      }, 200);
    }
    return clearTimer;
  }, [spinResponseReady, phase, clearTimer]);

  // Phase transitions
  useEffect(() => {
    if (phase === "idle" || phase === "spinning") return;

    clearTimer();

    const next = nextPhase(phase, { hasWild, hasPaylineWins, hasRespin });
    const delay = PHASE_TIMINGS[phase];

    timerRef.current = window.setTimeout(() => {
      setPhase(next);
    }, delay);

    return clearTimer;
  }, [phase, hasWild, hasPaylineWins, hasRespin, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return phase;
}

function nextPhase(
  current: Exclude<SpinPhase, "idle" | "spinning">,
  flags: { hasWild: boolean; hasPaylineWins: boolean; hasRespin: boolean },
): SpinPhase {
  switch (current) {
    case "reveal":
      return flags.hasWild ? "wild_expand" : flags.hasPaylineWins ? "paylines" : flags.hasRespin ? "pre_respin" : "result";
    case "wild_expand":
      return flags.hasPaylineWins ? "paylines" : flags.hasRespin ? "pre_respin" : "result";
    case "paylines":
      return flags.hasRespin ? "pre_respin" : "result";
    case "pre_respin":
      return "result";
    case "result":
      return "idle";
    default:
      return "idle";
  }
}
