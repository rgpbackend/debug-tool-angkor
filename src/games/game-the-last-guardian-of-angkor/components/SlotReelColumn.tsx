import { useMemo, type CSSProperties } from "react";
import { useReelStripMotion } from "../hooks/useReelStripMotion";
import { isCheatCellOverridden } from "../lib/cheat";
import {
  buildUnifiedReelStrip,
  type ReelVisualState,
} from "../lib/reel-spin";

type SlotReelColumnProps = {
  reelIndex: number;
  colLen: number;
  /** Settled symbols before this spin (viewport start position). */
  originColumn: string[];
  column: string[];
  loopSegment: string[];
  motionResult: string[];
  reelState: ReelVisualState;
  bouncing: boolean;
  editable: boolean;
  editGrid?: string[][];
  editDisabled?: boolean;
  showWinPresentation: boolean;
  cellWinWays: Map<string, number[]>;
  goldenWildHighlightKeys?: Set<string>;
  selectedColor: string;
  onEditCellChange?: (
    reelIndex: number,
    rowIndex: number,
    colLen: number,
    value: string,
  ) => void;
  onReelStopped: (reelIndex: number) => void;
};

function cellKey(reelIndex: number, rowIndex: number): string {
  return `${reelIndex}:${rowIndex}`;
}

function renderSymbolCell(
  sym: string,
  ci: number,
  ri: number,
  colLen: number,
  options: {
    editable: boolean;
    editGrid?: string[][];
    editDisabled: boolean;
    showWinPresentation: boolean;
    cellWinWays: Map<string, number[]>;
    goldenWildHighlightKeys?: Set<string>;
    selectedColor: string;
    onEditCellChange?: SlotReelColumnProps["onEditCellChange"];
    sourceColumn?: string[];
  },
) {
  const key = cellKey(ci, ri);
  const editValue = options.editGrid?.[ci]?.[ri] ?? sym;
  const sourceValue = options.sourceColumn?.[ri] ?? sym;
  const isOverridden =
    options.editable &&
    options.editGrid != null &&
    isCheatCellOverridden(editValue, sourceValue);
  const wayIndices = options.cellWinWays.get(key) ?? [];
  const winHit = options.showWinPresentation && wayIndices.length > 0;
  const gwHit =
    options.showWinPresentation &&
    (options.goldenWildHighlightKeys?.has(key) ?? false);
  const isScatter = sym === "S";
  const isWild = sym === "W";
  const cellClass = `cell sym-${sym}${isScatter ? " cell-scatter" : ""}${
    isWild ? " cell-wild" : ""
  }${winHit ? " cell-winway" : ""}${gwHit ? " cell-golden-wild" : ""}${
    options.editable ? " cell-editable" : ""
  }${isOverridden ? " cell-cheat-overridden" : ""}`;
  const cellTitle = isOverridden
    ? "Overridden cheat cell"
    : isScatter
      ? "Scatter"
      : isWild
        ? "Wild"
        : undefined;
  const cellStyle = winHit
    ? ({ "--winway-color": options.selectedColor } as CSSProperties)
    : undefined;

  if (options.editable && options.onEditCellChange) {
    return (
      <div
        key={`reel-r${ci + 1}-slot-${ri + 1}`}
        className={cellClass}
        style={cellStyle}
        title={cellTitle}
      >
        <input
          className="slot-cell-input"
          value={options.editGrid?.[ci]?.[ri] ?? ""}
          onChange={(e) =>
            options.onEditCellChange!(ci, ri, colLen, e.target.value)
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
          disabled={options.editDisabled}
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
}

function renderMotionSymbol(sym: string, ci: number, stripIndex: number) {
  return (
    <div
      key={`reel-r${ci + 1}-motion-${stripIndex}`}
      className={`cell cell--motion sym-${sym}${sym === "S" ? " cell-scatter" : ""}${
        sym === "W" ? " cell-wild" : ""
      }`}
    >
      <span className="cell-symbol">{sym}</span>
    </div>
  );
}

export default function SlotReelColumn({
  reelIndex: ci,
  colLen,
  originColumn,
  column,
  loopSegment,
  motionResult,
  reelState,
  bouncing,
  editable,
  editGrid,
  editDisabled = false,
  showWinPresentation,
  cellWinWays,
  goldenWildHighlightKeys,
  selectedColor,
  onEditCellChange,
  onReelStopped,
}: Readonly<SlotReelColumnProps>) {
  const stripResult = reelState === "stopping" ? column : motionResult;
  const motionStrip = useMemo(
    () => buildUnifiedReelStrip(originColumn, loopSegment, stripResult),
    [originColumn, loopSegment, stripResult],
  );

  const stripRef = useReelStripMotion({
    reelState,
    strip: motionStrip,
    onStopped: () => onReelStopped(ci),
  });

  const reelColClass = [
    "reel-col",
    `reel-col--rows-${colLen}`,
    reelState === "spinning" ? "reel-col--spinning" : "",
    reelState === "stopping" ? "reel-col--stopping" : "",
    reelState === "stopped" && bouncing ? "reel-col--bounce" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const reelColStyle = {
    "--reel-index": ci,
  } as CSSProperties;

  const cellOptions = {
    editable,
    editGrid,
    editDisabled,
    showWinPresentation,
    cellWinWays,
    goldenWildHighlightKeys,
    selectedColor,
    onEditCellChange,
  };

  if (reelState === "stopped" || reelState === "idle") {
    const displayColumn =
      editable && editGrid
        ? Array.from({ length: colLen }, (_, ri) => editGrid[ci]?.[ri] ?? "")
        : column;

    return (
      <div className={reelColClass} style={reelColStyle} data-rows={colLen}>
        {displayColumn.map((sym, ri) =>
          renderSymbolCell(sym, ci, ri, colLen, {
            ...cellOptions,
            sourceColumn: column,
          }),
        )}
      </div>
    );
  }

  return (
    <div className={reelColClass} style={reelColStyle} data-rows={colLen}>
      <div className="reel-viewport">
        <div ref={stripRef} className="reel-strip reel-strip--motion">
          {motionStrip.symbols.map((sym, i) => renderMotionSymbol(sym, ci, i))}
        </div>
      </div>
    </div>
  );
}
