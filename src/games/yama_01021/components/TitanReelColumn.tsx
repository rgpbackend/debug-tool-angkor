import { GRID_ROWS } from "../lib/paylines";
import type { ReelVisualState } from "../lib/reel-spin";

type TitanReelColumnProps = {
  reelIndex: number;
  column: string[];
  stripSymbols?: string[];
  reelState?: ReelVisualState;
  bouncing?: boolean;
  matchCells?: Set<number>;
};

export default function TitanReelColumn({
  reelIndex, column, stripSymbols, reelState = "idle", bouncing, matchCells,
}: TitanReelColumnProps) {
  const showStrip = stripSymbols && stripSymbols.length > 0 && reelState !== "idle";

  if (showStrip) {
    return (
      <div
        className={`titan-reel-col titan-reel-col--anim${reelState === "spinning" ? " titan-reel-col--spinning" : ""}${bouncing ? " titan-reel-col--bounce" : ""}`}
        data-reel={reelIndex}
      >
        <div className="titan-reel-viewport">
          <div className="titan-reel-strip">
            {stripSymbols.map((sym, i) => (
              <div key={i} className="titan-cell titan-cell--strip">
                <span className="titan-cell-symbol">{sym}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Static view (idle)
  const rows: string[] = [];
  for (let r = 0; r < GRID_ROWS; r++) rows.push(column[r] ?? "");

  return (
    <div className="titan-reel-col" data-reel={reelIndex}>
      {rows.map((sym, ri) => {
        const isMatch = matchCells?.has(ri) ?? false;
        return (
          <div key={`r${reelIndex}-c${ri}`} className={`titan-cell${isMatch ? " titan-cell--win" : ""}`}>
            <span className="titan-cell-symbol">{sym}</span>
          </div>
        );
      })}
    </div>
  );
}
