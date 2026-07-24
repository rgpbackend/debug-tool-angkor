import { useEffect, useRef, useState } from "react";
import type { TitanPaylineWin } from "../titan-protocol";

const CYCLE_MS = 600;

export function usePaylineCycle(paylineWins: TitanPaylineWin[], spinning: boolean) {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<number | null>(null);
  const prevKeyRef = useRef<string>("");

  // Build a stable key to detect new spin results
  const winsKey = paylineWins.map((w) => `${w.paylineId}:${w.winAmount}`).join(",");

  // Reset when new wins arrive (new spin result)
  useEffect(() => {
    if (winsKey !== prevKeyRef.current) {
      prevKeyRef.current = winsKey;
      setActiveIdx(0);
    }
  }, [winsKey]);

  // Clear when spinning
  useEffect(() => {
    if (spinning) {
      setActiveIdx(0);
    }
  }, [spinning]);

  // Cycle through paylines one at a time
  useEffect(() => {
    if (spinning || paylineWins.length <= 1) return;

    timerRef.current = window.setInterval(() => {
      setActiveIdx((prev) => {
        const next = prev + 1;
        if (next >= paylineWins.length) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return prev;
        }
        return next;
      });
    }, CYCLE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [spinning, paylineWins.length, winsKey]);

  const activeWin = spinning || paylineWins.length === 0
    ? null
    : paylineWins[Math.min(activeIdx, paylineWins.length - 1)] ?? null;

  return { activeIdx, activeWin, total: paylineWins.length };
}
