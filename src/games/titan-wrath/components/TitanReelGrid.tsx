import { useMemo } from "react";
import { parsePatternGrid } from "../titan-protocol";

interface TitanReelGridProps {
  patternGrid: string;
  lockedReels: number[];
  spinning: boolean;
  spinIndex: number;
}

const SYMBOL_CLASS: Record<string, string> = {
  A: "symbol-high",
  B: "symbol-high",
  C: "symbol-mid",
  D: "symbol-mid",
  E: "symbol-mid",
  F: "symbol-low",
  G: "symbol-low",
  W: "symbol-wild",
};

const COLS = 5;
const ROWS = 3;

export default function TitanReelGrid({
  patternGrid,
  lockedReels,
  spinning,
  spinIndex,
}: TitanReelGridProps) {
  const grid = useMemo(() => parsePatternGrid(patternGrid), [patternGrid]);

  return (
    <div className="titan-reel-grid" data-spinning={spinning ? "" : undefined}>
      {Array.from({ length: COLS }).map((_, col) => {
        const isLocked = lockedReels.includes(col);
        const delay = spinning ? `${col * 0.12}s` : "0s";
        return (
          <div
            key={`${spinIndex}-${col}`}
            className={`titan-reel-col${isLocked ? " reel-locked" : ""}${spinning ? " reel-spinning" : ""}`}
            style={{ animationDelay: delay }}
          >
            {Array.from({ length: ROWS }).map((_, row) => {
              const sym = grid[col]?.[row] ?? "";
              return (
                <div key={row} className={`titan-symbol-cell ${SYMBOL_CLASS[sym] ?? ""}`}>
                  <span className="titan-symbol-text">{sym}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
