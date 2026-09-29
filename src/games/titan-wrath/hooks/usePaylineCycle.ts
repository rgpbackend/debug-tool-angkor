import { useEffect, useRef, useState } from "react";
import type { TitanPaylineWin } from "../titan-protocol";

const CYCLE_MS = 700;

export function usePaylineCycle(paylineWins: TitanPaylineWin[], active: boolean) {
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<number | null>(null);
  const prevKeyRef = useRef<string>("");

  const winsKey = paylineWins.map((w) => `${w.paylineId}:${w.winAmount}`).join(",");

  // Reset when new wins arrive
  useEffect(() => {
    if (winsKey !== prevKeyRef.current) {
      prevKeyRef.current = winsKey;
      setActiveIdx(0);
    }
  }, [winsKey]);

  // Reset when deactivated
  useEffect(() => {
    if (!active) {
      setActiveIdx(0);
    }
  }, [active]);

  // Cycle through paylines, looping back to start
  useEffect(() => {
    if (!active || paylineWins.length <= 1) return;

    timerRef.current = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % paylineWins.length);
    }, CYCLE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, paylineWins.length, winsKey]);

  const currentWin = active && paylineWins.length > 0
    ? paylineWins[activeIdx % paylineWins.length] ?? null
    : null;

  return { activeIdx: active ? activeIdx % Math.max(paylineWins.length, 1) : 0, currentWin, total: paylineWins.length };
}
