import {
  ALCHEMY_GRID_SIZE,
  ALCHEMY_MARK_META,
  isAlchemyMarkColor,
} from "../alchemy-protocol";
import type { AlchemyDisplayCell } from "../lib/tumble";

type AlchemyGridProps = {
  cells: AlchemyDisplayCell[][];
  doubleWild?: boolean;
};

function cellClass(cell: AlchemyDisplayCell): string {
  const markColor = isAlchemyMarkColor(cell.mark) ? cell.mark : null;
  const symbolClass = cell.symbol ? `alchemy-cell--${cell.symbol.toLowerCase()}` : "";
  return [
    "alchemy-cell",
    symbolClass,
    `alchemy-cell--${cell.state}`,
    cell.fallRows > 0 && cell.state !== "new" && !cell.blockSize ? "alchemy-cell--fall" : "",
    cell.symbol === "W" && !cell.blockSize && !cell.blockMember ? "alchemy-cell--wild" : "",
    markColor && !cell.blockMember ? `alchemy-cell--mark-${ALCHEMY_MARK_META[markColor].css}` : "",
    cell.golden && !cell.blockMember ? "alchemy-cell--golden" : "",
    cell.blockSize ? "alchemy-cell--block-anchor" : "",
    cell.blockMember ? "alchemy-cell--block-member" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function symbolLabel(symbol: string, doubleWild: boolean): string {
  if (symbol === "W" && doubleWild) return "W×2";
  return symbol;
}

export default function AlchemyGrid({ cells, doubleWild = false }: AlchemyGridProps) {
  const nodes = [];
  for (let row = 0; row < ALCHEMY_GRID_SIZE; row++) {
    for (let col = 0; col < ALCHEMY_GRID_SIZE; col++) {
      const cell = cells[col]?.[row];
      const symbol = cell?.symbol ?? "";
      const mark = cell?.mark ?? "";
      const markColor = isAlchemyMarkColor(mark) ? mark : null;
      const hidden = Boolean(cell?.blockMember);
      const label = symbolLabel(symbol, doubleWild);
      nodes.push(
        <div
          key={`${col}-${row}`}
          className={cell ? cellClass(cell) : "alchemy-cell"}
          style={
            cell
              ? {
                  ["--alchemy-delay" as string]: `${cell.delay}ms`,
                  ["--alchemy-fall" as string]: String(cell.fallRows),
                  ["--block-size" as string]: String(cell.blockSize ?? 1),
                }
              : undefined
          }
          title={
            cell?.blockSize
              ? `${label} ${cell.blockSize}×${cell.blockSize}`
              : [label || "empty", markColor ? ALCHEMY_MARK_META[markColor].label : "", cell?.golden ? "Golden" : ""]
                  .filter(Boolean)
                  .join(" · ")
          }
        >
          {cell?.blockSize ? (
            <span className="alchemy-block-label">
              {label}
              <span className="alchemy-block-size">{cell.blockSize}×{cell.blockSize}</span>
            </span>
          ) : null}
          {!hidden && !cell?.blockSize ? (
            <span className="alchemy-cell-symbol">{label || "·"}</span>
          ) : null}
          {markColor && !cell?.blockMember && !cell?.blockSize ? (
            <span className="alchemy-mark" aria-label={ALCHEMY_MARK_META[markColor].label}>
              {markColor[0]}
            </span>
          ) : null}
        </div>,
      );
    }
  }

  return (
    <div className="alchemy-grid" role="grid" aria-label="Alchemy 8 by 8 grid">
      {nodes}
    </div>
  );
}
