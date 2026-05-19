import { useCallback, useEffect, useRef } from "react";

const AUTO_SPIN_BETWEEN_ROUNDS_MS = 0;

type UseAutoSpinArgs = {
  active: boolean;
  /** True when no round runner work and no spin/reel presentation. */
  roundIdle: boolean;
  canStartRound: boolean;
  onRunRound: () => void | Promise<void>;
};

/**
 * Schedules the next full round (base → features → end) after the previous
 * round fully settles — not after each individual cmd 1500 step.
 */
export function useAutoSpin({
  active,
  roundIdle,
  canStartRound,
  onRunRound,
}: UseAutoSpinArgs): void {
  const activeRef = useRef(active);
  const timerRef = useRef<number | null>(null);
  const prevRoundIdleRef = useRef(roundIdle);
  const onRunRoundRef = useRef(onRunRound);
  const canStartRoundRef = useRef(canStartRound);

  activeRef.current = active;
  onRunRoundRef.current = onRunRound;
  canStartRoundRef.current = canStartRound;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNextRound = useCallback(() => {
    clearTimer();
    if (!activeRef.current || !canStartRoundRef.current) {
      return;
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (!activeRef.current || !canStartRoundRef.current) {
        return;
      }
      void onRunRoundRef.current();
    }, AUTO_SPIN_BETWEEN_ROUNDS_MS);
  }, [clearTimer]);

  useEffect(() => {
    if (!active) {
      clearTimer();
    }
  }, [active, clearTimer]);

  useEffect(() => {
    const wasIdle = prevRoundIdleRef.current;
    prevRoundIdleRef.current = roundIdle;

    if (!active || !roundIdle || wasIdle) {
      return;
    }

    scheduleNextRound();
  }, [roundIdle, active, scheduleNextRound]);

  useEffect(() => () => clearTimer(), [clearTimer]);
}
