import { useMemo } from "react";
import { GRID_REELS, GRID_ROWS, type PaylineMatch } from "../lib/paylines";
import TitanReelColumn from "./TitanReelColumn";

type PaylineReelGridProps = {
  reels: string[][];
  matches: PaylineMatch[];
  spinning?: boolean;
};

export default function PaylineReelGrid({ reels, matches, spinning }: PaylineReelGridProps) {
  // Build cell→match highlight set: "reel,row" → true
  const matchCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of matches) {
      for (const [r, row] of m.positions) {
        s.add(`${r},${row}`);
      }
    }
    return s;
  }, [matches]);

  const normReels: string[][] = [];
  for (let c = 0; c < GRID_REELS; c++) {
    const col: string[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      col.push(reels[c]?.[r] ?? "");
    }
    normReels.push(col);
  }

  return (
    <div className="titan-reels-layout" aria-label="Slot reels">
      <div className="titan-reels-grid">
        {normReels.map((col, ci) => {
          const cellSet = new Set<number>();
          for (let ri = 0; ri < GRID_ROWS; ri++) {
            if (matchCellSet.has(`${ci},${ri}`)) cellSet.add(ri);
          }
          return (
            <TitanReelColumn
              key={`reel-${ci}`}
              reelIndex={ci}
              column={col}
              spinning={spinning}
              matchCells={cellSet}
            />
          );
        })}
      </div>
    </div>
  );
}
