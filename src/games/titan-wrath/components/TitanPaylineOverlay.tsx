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
  const showMultiplier =
    typeof currentWin.multiplier === "number" && currentWin.multiplier > 1;
  const winLabel = showMultiplier
    ? `$${currentWin.winAmount.toFixed(2)} x${currentWin.multiplier}`
    : `$${currentWin.winAmount.toFixed(2)}`;
  const labelW = showMultiplier ? 118 : 88;

  return (
    <svg
      className="titan-payline-overlay"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Active payline path */}
      {(() => {
        const d = makePath(activePayline?.rows ?? []);
        const dir = currentWin.direction === "RTL" ? -1 : 1;
        return (
          <g className="payline-group">
            <path
              d={d}
              fill="none"
              stroke="var(--titan-divine-amber)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`payline-glow${dir === -1 ? " payline-rtl" : ""}`}
            />
          </g>
        );
      })()}

      {/* Win amount label on the grid */}
      <g>
        <rect
          x={labelX - labelW / 2}
          y={labelY - 14}
          width={labelW}
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
          {winLabel}
        </text>
      </g>
    </svg>
  );
}
