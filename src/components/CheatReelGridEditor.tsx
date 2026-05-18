import { EXPECTED_CHEAT_REEL_SIZES } from "../lib/cheat";

export interface CheatReelGridEditorProps {
  cheatGrid: string[][];
  canCheat: boolean;
  onCellChange: (
    reelIndex: number,
    rowIndex: number,
    colLen: number,
    value: string,
  ) => void;
}

export default function CheatReelGridEditor({
  cheatGrid,
  canCheat,
  onCellChange,
}: Readonly<CheatReelGridEditorProps>) {
  return (
    <div className="cheat-grid-wrap">
      <div className="cheat-grid" aria-label="Cheat reel grid">
        {EXPECTED_CHEAT_REEL_SIZES.map((size, ci) => (
          <div
            key={`cheat-reel-r${ci + 1}-cells-${size}`}
            className="cheat-col"
          >
            {Array.from({ length: size }, (_, ri) => (
              <input
                key={`cheat-reel-r${ci + 1}-slot-${ri + 1}`}
                className="cheat-cell-input"
                value={cheatGrid[ci]?.[ri] ?? ""}
                onChange={(e) => onCellChange(ci, ri, size, e.target.value)}
                maxLength={2}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                aria-label={`Reel ${ci + 1} row ${ri + 1}`}
                disabled={!canCheat}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
