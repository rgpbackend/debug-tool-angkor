import { usePaylineCycle } from "../hooks/usePaylineCycle";
import type { TitanPaylineWin } from "../titan-protocol";
import type { ServerPayline } from "../../../ws/protocol";

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
  ready: boolean;
}

export default function TitanPaylineOverlay({
  paylines,
  paylineWins,
  ready,
}: TitanPaylineOverlayProps) {
  const { currentWin } = usePaylineCycle(paylineWins, ready);

  if (!ready || paylineWins.length === 0 || !currentWin) return null;

  const highlightId = currentWin.paylineId;
  const activePayline = paylines.find((p) => p.id === highlightId);

  // Position the win amount text at the middle column near the payline path
  const labelCol = 2; // middle column
  const labelRow = activePayline?.rows?.[labelCol] ?? 1;
  const labelX = colCenter(labelCol);
  const labelY = rowCenter(labelRow) + 28; // offset below the path

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
            <g key={p.id} className="payline-group" opacity={isActive ? 1 : 0.15}>
              <path
                d={d}
                fill="none"
                stroke="var(--titan-divine-amber)"
                strokeWidth={isActive ? 3 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`payline-glow${dir === -1 ? " payline-rtl" : ""}`}
              />
            </g>
          );
        })}

      {/* Win amount label on the grid */}
      <g>
        <rect
          x={labelX - 44}
          y={labelY - 14}
          width={88}
          height={28}
          rx={6}
          fill="var(--titan-obsidian)"
          fillOpacity={0.85}
          stroke="var(--titan-forge-gold)"
          strokeWidth={1}
          strokeOpacity={0.5}
        />
        <text
          x={labelX}
          y={labelY + 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--titan-forge-gold)"
          fontFamily="var(--titan-display)"
          fontSize={16}
          fontWeight={700}
        >
          ${currentWin.winAmount.toFixed(2)}
        </text>
      </g>
    </svg>
  );
}
