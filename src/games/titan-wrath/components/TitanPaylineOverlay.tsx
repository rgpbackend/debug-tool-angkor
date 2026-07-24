import { usePaylineCycle } from "../hooks/usePaylineCycle";
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
  spinning: boolean;
}

export default function TitanPaylineOverlay({
  paylines,
  paylineWins,
  spinning,
}: TitanPaylineOverlayProps) {
  const { activeWin } = usePaylineCycle(paylineWins, spinning);

  if (spinning || paylineWins.length === 0 || !activeWin) return null;

  const highlightId = activeWin.paylineId;

  return (
    <svg
      className="titan-payline-overlay"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
    >
      {paylines
        .filter((p) => paylineWins.some((w) => w.paylineId === p.id))
        .map((p) => {
          const isActive = p.id === highlightId;
          const win = paylineWins.find((w) => w.paylineId === p.id);
          const d = PAYLINE_PATHS[p.id] ?? makePath(p.rows);
          const dir = win?.direction === "RTL" ? -1 : 1;
          return (
            <g key={p.id} className="payline-group" opacity={isActive ? 1 : 0.18}>
              <path
                d={d}
                fill="none"
                stroke="var(--titan-divine-amber)"
                strokeWidth={isActive ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`payline-glow${dir === -1 ? " payline-rtl" : ""}`}
              />
            </g>
          );
        })}
    </svg>
  );
}
