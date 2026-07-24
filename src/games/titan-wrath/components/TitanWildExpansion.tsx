import { useEffect, useState } from "react";
import type { TitanWildSpinInfo } from "../titan-protocol";

const COLS = 5;

interface TitanWildExpansionProps {
  wildInfo: TitanWildSpinInfo | undefined;
  onComplete: () => void;
}

export default function TitanWildExpansion({
  wildInfo,
  onComplete,
}: TitanWildExpansionProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!wildInfo?.triggered || wildInfo.wildReels.length === 0) {
      setAnimating(false);
      return;
    }
    setAnimating(true);
    const timer = window.setTimeout(() => {
      setAnimating(false);
      onComplete();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [wildInfo, onComplete]);

  if (!animating || !wildInfo) return null;

  return (
    <div className="titan-wild-expansion" aria-hidden>
      {wildInfo.wildReels.map((col) => (
        <div
          key={col}
          className="wild-fire-burst"
          style={{ left: `${(col / COLS) * 100}%`, width: `${(1 / COLS) * 100}%` }}
        >
          <span className="wild-fire-text">W</span>
        </div>
      ))}
    </div>
  );
}
