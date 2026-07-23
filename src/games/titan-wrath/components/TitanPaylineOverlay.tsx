import type { TitanPaylineWin } from "../titan-protocol";
import type { ServerPayline } from "../../ws/protocol";

const CELL_W = 70;
const CELL_H = 70;

function makePath(rows: number[]): string {
  const pts = rows.map((row, col) => {
    const x = col * CELL_W + 32;
    const y = row * CELL_H + 32;
    return `${col === 0 ? "M" : "L"} ${x} ${y}`;
  });
  return pts.join(" ");
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
      viewBox={`0 0 ${CELL_W * 5 - 6} ${CELL_H * 3 - 6}`}
      preserveAspectRatio="xMidYMid meet"
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
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`payline-glow${direction === -1 ? " payline-rtl" : ""}`}
              />
              {win && (
                <text
                  x={CELL_W * 2.5 - 3}
                  y={p.rows[2] * CELL_H + 28}
                  textAnchor="middle"
                  className="payline-win-text"
                  fill="var(--titan-forge-gold)"
                  fontFamily="var(--titan-display)"
                  fontSize={14}
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
