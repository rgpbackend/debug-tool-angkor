import { useEffect, useMemo, useRef } from "react";
import { GRID_REELS, GRID_ROWS, type PaylineMatch } from "../lib/paylines";
import { useReelSpin } from "../hooks/useReelSpin";
import TitanReelColumn from "./TitanReelColumn";

type PaylineReelGridProps = {
  reels: string[][];
  matches: PaylineMatch[];
  spinning?: boolean;
};

const CELL = 68;
const GAP = 6;
const STEP = CELL + GAP;

const LINE_COLORS = ["#e6cc6e", "#a78bfa", "#22d3ee", "#f97316", "#4ade80", "#f472b6", "#fbbf24", "#818cf8"];

function cellCenter(reel: number, row: number) {
  return { x: reel * STEP + CELL / 2, y: row * STEP + CELL / 2 };
}

export default function PaylineReelGrid({ reels, matches, spinning = false }: PaylineReelGridProps) {
  const { reelStates, bouncingReel, beginSpin, stopReels } = useReelSpin();
  const prevSpinningRef = useRef(false);
  const spinStartedRef = useRef(false);

  // Trigger spin animation on spinning=true edge
  useEffect(() => {
    if (spinning && !prevSpinningRef.current) {
      spinStartedRef.current = true;
      beginSpin(reels);
    }
    if (!spinning && prevSpinningRef.current && spinStartedRef.current) {
      stopReels(reels);
      spinStartedRef.current = false;
    }
    prevSpinningRef.current = spinning;
  }, [spinning, reels, beginSpin, stopReels]);

  const matchCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of matches) for (const [r, row] of m.positions) s.add(`${r},${row}`);
    return s;
  }, [matches]);

  // Payline SVG lines
  const lines = useMemo(() => {
    return matches.map((m, i) => {
      const pts = m.positions.map(([r, row]) => cellCenter(r, row));
      if (pts.length < 2) return null;
      const d = pts.map((p, j) => `${j === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
      return { d, color: LINE_COLORS[i % LINE_COLORS.length], ltr: m.direction === "ltr" };
    }).filter(Boolean) as { d: string; color: string; ltr: boolean }[];
  }, [matches]);

  const normReels: string[][] = [];
  for (let c = 0; c < GRID_REELS; c++) {
    const col: string[] = [];
    for (let r = 0; r < GRID_ROWS; r++) col.push(reels[c]?.[r] ?? "");
    normReels.push(col);
  }

  const svgW = GRID_REELS * STEP - GAP;
  const svgH = GRID_ROWS * STEP - GAP;

  return (
    <div className="titan-reels-layout" aria-label="Slot reels">
      <div className="titan-reels-grid" style={{ position: "relative" }}>
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
              reelState={reelStates[ci]}
              bouncing={bouncingReel === ci}
              matchCells={cellSet}
            />
          );
        })}

        {/* Payline SVG overlay */}
        {lines.length > 0 && !spinning && (
          <svg
            className="titan-paylines-svg"
            width={svgW} height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 3 }}
          >
            {lines.map((l, i) => (
              <g key={i}>
                <path d={l.d} fill="none" stroke={l.color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
                <path d={l.d} fill="none" stroke={l.color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                <path d={l.d} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="8 20" opacity={0.7}
                  className={l.ltr ? "titan-payline-flow-ltr" : "titan-payline-flow-rtl"} />
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
