import type { TitanPaylineWin } from "../titan-protocol";
import type { ServerPayline } from "../../../ws/protocol";

// Grid units: 5 columns × 3 rows, cell centers at (c+0.5, r+0.5)
const COLS = 5;
const ROWS = 3;
const UNIT_W = 100;
const UNIT_H = 100;
const SVG_W = COLS * UNIT_W;
const SVG_H = ROWS * UNIT_H;

function colCenter(col: number) { return col * UNIT_W + UNIT_W / 2; }
function rowCenter(row: number) { return row * UNIT_H + UNIT_H / 2; }

function makePath(rows: number[]): string {
  return rows.map((row, col) => {
    const x = colCenter(col);
    const y = rowCenter(row);
    return `${col === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}

const PAYLINE_PATHS: Record<string, string> = {
  P01: makePath([1, 1, 1, 1, 1]),
  P02: makePath([0, 0, 0, 0, 0]),
  P03: makePath([2, 2, 2, 2, 2]),
  P04: makePath([2, 1, 0, 1, 2]),
  P05: makePath([0, 1, 2, 1, 0]),
  P06: makePath([0, 0, 1, 0, 0]),
  P07: makePath([2, 0, 1, 0, 0]),
  P08: makePath([1, 2, 2, 2, 1]),
  P09: makePath([1, 0, 0, 0, 1]),
  P10: makePath([1, 0, 1, 0, 1]),
};

interface TitanPaylineOverlayProps {
  paylines: ServerPayline[];
  paylineWins: TitanPaylineWin[];
  visible: boolean;
}

export default function TitanPaylineOverlay({
  paylines,
  paylineWins,
  visible,
}: TitanPaylineOverlayProps) {
  if (!visible || paylineWins.length === 0) return null;

  const winIds = new Set(paylineWins.map((w) => w.paylineId));

  return (
    <svg
      className="titan-payline-overlay"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
    >
      {paylines
        .filter((p) => winIds.has(p.id))
        .map((p) => {
          const win = paylineWins.find((w) => w.paylineId === p.id);
          const pathData = PAYLINE_PATHS[p.id] ?? makePath(p.rows);
          const direction = win?.direction === "RTL" ? -1 : 1;
          return (
            <g key={p.id} className="payline-group">
              <path
                d={pathData}
                fill="none"
                stroke="var(--titan-divine-amber)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`payline-glow${direction === -1 ? " payline-rtl" : ""}`}
              />
              {win && (
                <text
                  x={colCenter(2)}
                  y={rowCenter(p.rows[2]) + 4}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="payline-win-text"
                  fill="var(--titan-forge-gold)"
                  fontFamily="var(--titan-display)"
                  fontSize={18}
                  fontWeight={700}
                >
                  ${win.winAmount.toFixed(2)}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}
