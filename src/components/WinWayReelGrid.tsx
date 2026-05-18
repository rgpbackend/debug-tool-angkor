import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { EXPECTED_CHEAT_REEL_SIZES } from "../lib/cheat";
import type { WinWay } from "../ws/protocol";

const WINWAY_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#84cc16",
] as const;

function cellKey(reelIndex: number, rowIndex: number): string {
  return `${reelIndex}:${rowIndex}`;
}

function buildCellWinWayMap(ways: WinWay[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  ways.forEach((way, wayIndex) => {
    way.positions?.forEach((rows, reelIndex) => {
      if (!rows) {
        return;
      }
      rows.forEach((rowIndex) => {
        const key = cellKey(reelIndex, rowIndex);
        const existing = map.get(key) ?? [];
        if (!existing.includes(wayIndex)) {
          existing.push(wayIndex);
        }
        map.set(key, existing);
      });
    });
  });
  return map;
}

function filterCellWinWayMap(
  map: Map<string, number[]>,
  wayIndex: number,
): Map<string, number[]> {
  const filtered = new Map<string, number[]>();
  for (const [key, indices] of map) {
    if (indices.includes(wayIndex)) {
      filtered.set(key, [wayIndex]);
    }
  }
  return filtered;
}

function winWayColor(wayIndex: number): string {
  return WINWAY_COLORS[wayIndex % WINWAY_COLORS.length];
}

export interface WinWayReelGridProps {
  reels: string[][];
  winWays: WinWay[];
  goldenWildHighlightKeys?: Set<string>;
  ariaLabel?: string;
  /** When true, uses slot-cabinet layout and responsive scaling. */
  cabinet?: boolean;
  /** Remaining respins; badge top-left when visible. */
  respinRemaining?: number | null;
  respinVisible?: boolean;
  /** Remaining free spins; badge top-right when visible. */
  freeSpinRemaining?: number | null;
  freeSpinVisible?: boolean;
  /** Free-spin scatter collection meter (0–target). */
  freeSpinScatterCollected?: number;
  freeSpinScatterTarget?: number;
  /** Cabinet: cells become inputs bound to editGrid. */
  editable?: boolean;
  editGrid?: string[][];
  editDisabled?: boolean;
  onEditCellChange?: (
    reelIndex: number,
    rowIndex: number,
    colLen: number,
    value: string,
  ) => void;
}

export default function WinWayReelGrid({
  reels,
  winWays,
  goldenWildHighlightKeys,
  ariaLabel = "Spin result reels",
  cabinet = false,
  respinRemaining = null,
  respinVisible = false,
  freeSpinRemaining = null,
  freeSpinVisible = false,
  freeSpinScatterCollected = 0,
  freeSpinScatterTarget = 5,
  editable = false,
  editGrid,
  editDisabled = false,
  onEditCellChange,
}: Readonly<WinWayReelGridProps>) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [winWays]);

  const safeSelectedIndex =
    winWays.length === 0
      ? 0
      : Math.min(Math.max(selectedIndex, 0), winWays.length - 1);

  const fullCellWinWays = useMemo(() => buildCellWinWayMap(winWays), [winWays]);
  const cellWinWays = useMemo(
    () => filterCellWinWayMap(fullCellWinWays, safeSelectedIndex),
    [fullCellWinWays, safeSelectedIndex],
  );

  const selectedColor = winWayColor(safeSelectedIndex);

  const layoutClass = cabinet
    ? "winway-reels-layout winway-reels-layout--cabinet"
    : "winway-reels-layout";

  const showLegendSlot = cabinet || winWays.length > 0;

  return (
    <div className={layoutClass}>
      {showLegendSlot ? (
        <aside
          className={`winway-legend-panel${cabinet && winWays.length === 0 ? " winway-legend-panel--empty" : ""}`}
          aria-label="Win ways legend"
        >
          {cabinet ? (
            <p className="winway-legend-heading">Win ways</p>
          ) : null}
          {winWays.length > 0 ? (
            <ul
              className="winway-legend"
              role="listbox"
              aria-label="Select win way"
            >
              {winWays.map((way, idx) => {
              const color = winWayColor(idx);
              const isActive = idx === safeSelectedIndex;
              return (
                <li
                  key={`winway-legend-${way.symbol}-${idx}`}
                  className={`winway-legend-item${isActive ? " winway-legend-item-active" : ""}`}
                  role="option"
                  aria-selected={isActive}
                >
                  <button
                    type="button"
                    className="winway-legend-btn"
                    onClick={() => setSelectedIndex(idx)}
                  >
                    <span
                      className="winway-legend-swatch"
                      style={{ background: color }}
                      aria-hidden
                    />
                    <span className="winway-legend-body">
                      <span
                        className="winway-legend-num"
                        style={{ color: isActive ? color : undefined }}
                      >
                        #{idx + 1}
                      </span>
                      <span className="winway-legend-text">
                        {way.symbol} ×{way.matchCount}
                      </span>
                      <span className="winway-legend-meta muted">
                        {way.ways} way{way.ways === 1 ? "" : "s"} ·{" "}
                        {String(way.payout)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            </ul>
          ) : (
            <p className="winway-legend-empty muted">
              No win ways this spin
            </p>
          )}
        </aside>
      ) : null}

      <div className="reels-wrap winway-reels-main slot-reels-stage">
        {cabinet && (respinVisible || freeSpinVisible) ? (
          <div className="slot-reels-hud">
            {respinVisible ? (
              <div
                className="slot-reels-badge slot-reels-badge--respin"
                title="Respin remaining"
              >
                <span className="slot-reels-badge-label">Respin</span>
                <span className="slot-reels-badge-count">
                  {respinRemaining ?? 0}
                </span>
              </div>
            ) : null}
            {freeSpinVisible ? (
              <div className="slot-reels-hud-freespin-cluster">
                <div
                  className="slot-scatter-tracker"
                  title="Collect scatters during free spins"
                  role="img"
                  aria-label={`${freeSpinScatterCollected} of ${freeSpinScatterTarget} scatters collected`}
                >
                  <div className="slot-scatter-tracker-slots">
                    {Array.from(
                      { length: freeSpinScatterTarget },
                      (_, index) => {
                        const filled = index < freeSpinScatterCollected;
                        return (
                          <span
                            key={`scatter-slot-${index}`}
                            className={`slot-scatter-tracker-slot${filled ? " slot-scatter-tracker-slot--filled" : ""}`}
                            aria-hidden
                          >
                            S
                          </span>
                        );
                      },
                    )}
                  </div>
                </div>
                <div
                  className="slot-reels-badge slot-reels-badge--freespin"
                  title="Free spins remaining"
                >
                  <span className="slot-reels-badge-label">Free spin</span>
                  <span className="slot-reels-badge-count">
                    {freeSpinRemaining ?? 0}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          className={`reels${editable ? " reels--editable" : ""}`}
          aria-label={ariaLabel}
        >
          {EXPECTED_CHEAT_REEL_SIZES.map((colLen, ci) => {
            const column = reels[ci] ?? [];
            return (
              <div
                key={`reel-r${ci + 1}-cells-${colLen}`}
                className="reel-col"
              >
                {Array.from({ length: colLen }, (_, ri) => {
                  const sym =
                    editable && editGrid
                      ? (editGrid[ci]?.[ri] ?? "")
                      : (column[ri] ?? "");
                  const key = cellKey(ci, ri);
                  const wayIndices = cellWinWays.get(key) ?? [];
                  const winHit = wayIndices.length > 0;
                  const gwHit = goldenWildHighlightKeys?.has(key) ?? false;
                  const isScatter = sym === "S";
                  const isWild = sym === "W";
                  const cellClass = `cell sym-${sym}${isScatter ? " cell-scatter" : ""}${
                    isWild ? " cell-wild" : ""
                  }${winHit ? " cell-winway" : ""}${
                    gwHit ? " cell-golden-wild" : ""
                  }${editable ? " cell-editable" : ""}`;
                  const cellTitle = isScatter
                    ? "Scatter"
                    : isWild
                      ? "Wild"
                      : undefined;
                  const cellStyle = winHit
                    ? ({
                        "--winway-color": selectedColor,
                      } as CSSProperties)
                    : undefined;

                  if (editable && onEditCellChange) {
                    return (
                      <div
                        key={`reel-r${ci + 1}-slot-${ri + 1}`}
                        className={cellClass}
                        style={cellStyle}
                        title={cellTitle}
                      >
                        <input
                          className="slot-cell-input"
                          value={editGrid?.[ci]?.[ri] ?? ""}
                          onChange={(e) =>
                            onEditCellChange(ci, ri, colLen, e.target.value)
                          }
                          maxLength={2}
                          inputMode="text"
                          autoComplete="off"
                          spellCheck={false}
                          aria-label={
                            isScatter
                              ? `Reel ${ci + 1} row ${ri + 1}, scatter`
                              : isWild
                                ? `Reel ${ci + 1} row ${ri + 1}, wild`
                                : `Reel ${ci + 1} row ${ri + 1}`
                          }
                          disabled={editDisabled}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`reel-r${ci + 1}-slot-${ri + 1}`}
                      className={cellClass}
                      style={cellStyle}
                      title={cellTitle}
                    >
                      <span className="cell-symbol">{sym}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
