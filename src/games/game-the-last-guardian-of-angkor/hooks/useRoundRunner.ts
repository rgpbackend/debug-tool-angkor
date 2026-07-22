import { useCallback, useRef, useState } from "react";
import { useSyncRef } from "../../../hooks/useSyncRef";
import { isRoundUnfinished } from "../lib/round-flow";
import { waitAfterSpinStep } from "../lib/wait-for-spin-ui";
import type { SpinResponsePayload } from "../../../ws/protocol";

type UseRoundRunnerArgs = {
  spin: () => Promise<SpinResponsePayload | null>;
  isSpinUiActive: () => boolean;
  canStartRound: boolean;
};

export function useRoundRunner({
  spin,
  isSpinUiActive,
  canStartRound,
}: UseRoundRunnerArgs) {
  const [roundRunning, setRoundRunning] = useState(false);
  const roundRunningRef = useRef(false);
  const cancelRef = useRef(false);
  const spinRef = useRef(spin);
  const isSpinUiActiveRef = useRef(isSpinUiActive);
  const canStartRoundRef = useRef(canStartRound);

  useSyncRef(spinRef, spin);
  useSyncRef(isSpinUiActiveRef, isSpinUiActive);
  useSyncRef(canStartRoundRef, canStartRound);

  const cancelRound = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const executeRound = useCallback(async () => {
    if (roundRunningRef.current || !canStartRoundRef.current) {
      return;
    }

    cancelRef.current = false;
    roundRunningRef.current = true;
    setRoundRunning(true);

    try {
      while (!cancelRef.current) {
        const payload = await spinRef.current();
        if (!payload || cancelRef.current) {
          break;
        }

        await waitAfterSpinStep(payload, () => isSpinUiActiveRef.current());

        if (cancelRef.current || !isRoundUnfinished(payload)) {
          break;
        }
      }
    } finally {
      roundRunningRef.current = false;
      setRoundRunning(false);
    }
  }, []);

  const executeStep = useCallback(async () => {
    if (roundRunningRef.current || !canStartRoundRef.current) {
      return;
    }

    cancelRef.current = false;
    roundRunningRef.current = true;
    setRoundRunning(true);

    try {
      const payload = await spinRef.current();
      if (!payload || cancelRef.current) {
        return;
      }

      await waitAfterSpinStep(payload, () => isSpinUiActiveRef.current());
    } finally {
      roundRunningRef.current = false;
      setRoundRunning(false);
    }
  }, []);

  return {
    roundRunning,
    executeRound,
    executeStep,
    cancelRound,
  };
}
