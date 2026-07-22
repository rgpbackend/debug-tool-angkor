import { GRID_ROWS } from "../lib/paylines";

type TitanReelColumnProps = {
  reelIndex: number;
  column: string[];
  spinning?: boolean;
  matchCells?: Set<number>;
};

export default function TitanReelColumn({ column, spinning, matchCells }: TitanReelColumnProps) {
  const rows: string[] = [];
  for (let r = 0; r < GRID_ROWS; r++) rows.push(column[r] ?? "");

  return (
    <div className={`titan-reel-col${spinning ? " titan-reel-col--spinning" : ""}`}>
      {rows.map((sym, ri) => {
        const isMatch = matchCells?.has(ri) ?? false;
        return (
          <div key={`r${ri}`} className={`titan-cell${isMatch ? " titan-cell--win" : ""}`}>
            <span className="titan-cell-symbol">{sym}</span>
          </div>
        );
      })}
    </div>
  );
}
