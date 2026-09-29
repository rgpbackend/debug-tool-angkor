import { useCallback, useEffect, useRef } from "react";
import { useSyncRef } from "../../../hooks/useSyncRef";

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
  const prevActiveRef = useRef(active);
  const onRunRoundRef = useRef(onRunRound);
  const canStartRoundRef = useRef(canStartRound);

  useSyncRef(activeRef, active);
  useSyncRef(onRunRoundRef, onRunRound);
  useSyncRef(canStartRoundRef, canStartRound);

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

  // Fire when round becomes idle OR auto-spin becomes active while already idle.
  useEffect(() => {
    const becameIdle = roundIdle && !prevRoundIdleRef.current;
    const becameActive = active && !prevActiveRef.current;
    prevRoundIdleRef.current = roundIdle;
    prevActiveRef.current = active;

    if (!active || !roundIdle) return;

    if (becameIdle || becameActive) {
      scheduleNextRound();
    }
  }, [roundIdle, active, scheduleNextRound]);

  useEffect(() => () => clearTimer(), [clearTimer]);
}
