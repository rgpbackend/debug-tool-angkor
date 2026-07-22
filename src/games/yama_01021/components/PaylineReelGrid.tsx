import { useMemo } from "react";
import { GRID_REELS, GRID_ROWS, type PaylineMatch } from "../lib/paylines";
import TitanReelColumn from "./TitanReelColumn";

type PaylineReelGridProps = {
  reels: string[][];
  matches: PaylineMatch[];
  spinning?: boolean;
};

const CELL = 68;
const GAP = 6;
const STEP = CELL + GAP; // 74px

const LINE_COLORS = ["#e6cc6e", "#a78bfa", "#22d3ee", "#f97316", "#4ade80", "#f472b6", "#fbbf24", "#818cf8"];

function cellCenter(reel: number, row: number): { x: number; y: number } {
  return { x: reel * STEP + CELL / 2, y: row * STEP + CELL / 2 };
}

export default function PaylineReelGrid({ reels, matches, spinning }: PaylineReelGridProps) {
  const matchCellSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of matches) {
      for (const [r, row] of m.positions) s.add(`${r},${row}`);
    }
    return s;
  }, [matches]);

  // Payline SVG paths
  const lines = useMemo(() => {
    return matches.map((m, i) => {
      const pts = m.positions.map(([r, row]) => cellCenter(r, row));
      if (pts.length < 2) return null;
      const d = pts.map((p, j) => `${j === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
      const last = pts[pts.length - 1];
      const secondLast = pts[pts.length - 2];
      const angle = Math.atan2(last.y - secondLast.y, last.x - secondLast.x) * (180 / Math.PI);
      const color = LINE_COLORS[i % LINE_COLORS.length];
      return { d, last, angle, color, ltr: m.direction === "ltr" };
    }).filter(Boolean) as { d: string; last: { x: number; y: number }; angle: number; color: string; ltr: boolean }[];
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
              spinning={spinning}
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
            <defs>
              <marker id="arrow-ltr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="currentColor" />
              </marker>
              <marker id="arrow-rtl" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                <polygon points="8 0, 0 3, 8 6" fill="currentColor" />
              </marker>
            </defs>
            {lines.map((l, i) => {
              const pathId = `pl-${i}`;
              return (
                <g key={i}>
                  {/* Glow underlay */}
                  <path
                    id={pathId}
                    d={l.d}
                    fill="none"
                    stroke={l.color}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.2}
                  />
                  {/* Main line */}
                  <path
                    d={l.d}
                    fill="none"
                    stroke={l.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={`url(#arrow-${l.ltr ? "ltr" : "rtl"})`}
                  />
                  {/* Electric dash flowing in win direction */}
                  <path
                    d={l.d}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="8 20"
                    opacity={0.7}
                    className={l.ltr ? "titan-payline-flow-ltr" : "titan-payline-flow-rtl"}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
