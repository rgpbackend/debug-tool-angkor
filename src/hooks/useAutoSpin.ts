import { useCallback, useEffect, useRef } from "react";
import { CELEBRATION_SEQUENCE_MS } from "../lib/celebration-timing";

const AUTO_SPIN_PAUSE_MS = 2000;
const CAN_SPIN_RETRY_MS = 500;

type UseAutoSpinArgs = {
  active: boolean;
  spinUiActive: boolean;
  canSpin: boolean;
  celebrationCount: number;
  spin: () => void | Promise<void>;
};

export function useAutoSpin({
  active,
  spinUiActive,
  canSpin,
  celebrationCount,
  spin,
}: UseAutoSpinArgs): void {
  const activeRef = useRef(active);
  const spinRef = useRef(spin);
  const canSpinRef = useRef(canSpin);
  const timerRef = useRef<number | null>(null);
  const prevSpinUiActiveRef = useRef(spinUiActive);

  activeRef.current = active;
  spinRef.current = spin;
  canSpinRef.current = canSpin;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSpin = useCallback(() => {
    if (!activeRef.current) {
      return;
    }
    if (!canSpinRef.current) {
      timerRef.current = window.setTimeout(runSpin, CAN_SPIN_RETRY_MS);
      return;
    }
    void spinRef.current();
  }, []);

  const scheduleAfterEffects = useCallback(() => {
    clearTimer();
    if (!activeRef.current) {
      return;
    }
    const delay =
      (celebrationCount > 0 ? CELEBRATION_SEQUENCE_MS : 0) + AUTO_SPIN_PAUSE_MS;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      runSpin();
    }, delay);
  }, [celebrationCount, clearTimer, runSpin]);

  useEffect(() => {
    if (!active) {
      clearTimer();
    }
  }, [active, clearTimer]);

  useEffect(() => {
    const wasBusy = prevSpinUiActiveRef.current;
    prevSpinUiActiveRef.current = spinUiActive;

    if (!active || !wasBusy || spinUiActive) {
      return;
    }
    scheduleAfterEffects();
  }, [spinUiActive, active, scheduleAfterEffects]);

  useEffect(() => () => clearTimer(), [clearTimer]);
}
