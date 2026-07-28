import { useMemo, type CSSProperties } from "react";
import { useReelStripMotion } from "../hooks/useReelStripMotion";
import {
  buildUnifiedReelStrip,
  type ReelVisualState,
} from "../lib/reel-spin";
import { getSymbolImage } from "../assets/symbols";

const SYMBOL_CLASS: Record<string, string> = {
  A: "symbol-high",
  B: "symbol-high",
  C: "symbol-mid",
  D: "symbol-mid",
  E: "symbol-mid",
  F: "symbol-low",
  G: "symbol-low",
  W: "symbol-wild",
};

type TitanReelColumnProps = {
  reelIndex: number;
  colLen: number;
  originColumn: string[];
  column: string[];
  loopSegment: string[];
  motionResult: string[];
  reelState: ReelVisualState;
  bouncing: boolean;
  locked: boolean;
  onReelStopped: (reelIndex: number) => void;
};

function renderCell(sym: string, reelIndex: number, rowIndex: number) {
  const displaySym = sym || "·";
  const imgSrc = sym ? getSymbolImage(sym) : undefined;
  return (
    <div key={`r${reelIndex}-row${rowIndex}`} className={`cell titan-symbol-cell ${sym ? (SYMBOL_CLASS[sym] ?? "") : "cell--empty"}`}>
      {imgSrc ? (
        <img src={imgSrc} alt={sym} className="titan-symbol-img" />
      ) : (
        <span className="titan-symbol-text">{displaySym}</span>
      )}
    </div>
  );
}

function renderMotionCell(sym: string, reelIndex: number, stripIndex: number) {
  const displaySym = sym || "·";
  const imgSrc = sym ? getSymbolImage(sym) : undefined;
  return (
    <div key={`r${reelIndex}-m${stripIndex}`} className={`cell titan-symbol-cell cell--motion ${sym ? (SYMBOL_CLASS[sym] ?? "") : "cell--empty"}`}>
      {imgSrc ? (
        <img src={imgSrc} alt={sym} className="titan-symbol-img" />
      ) : (
        <span className="titan-symbol-text">{displaySym}</span>
      )}
    </div>
  );
}

export default function TitanReelColumn({
  reelIndex,
  colLen: _colLen,
  originColumn,
  column,
  loopSegment,
  motionResult,
  reelState,
  bouncing,
  locked,
  onReelStopped,
}: Readonly<TitanReelColumnProps>) {
  const stripResult = reelState === "stopping" ? column : motionResult;
  const motionStrip = useMemo(
    () => buildUnifiedReelStrip(originColumn, loopSegment, stripResult),
    [originColumn, loopSegment, stripResult],
  );

  const stripRef = useReelStripMotion({
    reelState,
    strip: motionStrip,
    onStopped: () => onReelStopped(reelIndex),
  });

  const reelColClass = [
    "titan-reel-col",
    reelState === "spinning" ? "reel-spinning" : "",
    reelState === "stopping" ? "reel-stopping" : "",
    reelState === "stopped" && bouncing ? "reel-bounce" : "",
    locked ? "reel-locked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const reelColStyle = {
    "--reel-index": reelIndex,
  } as CSSProperties;

  // Locked or stopped: show static result
  if (locked || reelState === "stopped" || reelState === "idle") {
    return (
      <div className={reelColClass} style={reelColStyle}>
        {column.map((sym, ri) => renderCell(sym, reelIndex, ri))}
      </div>
    );
  }

  // Spinning or stopping: show motion strip
  return (
    <div className={reelColClass} style={reelColStyle}>
      <div className="reel-viewport">
        <div ref={stripRef} className="reel-strip reel-strip--motion">
          {motionStrip.symbols.map((sym, i) => renderMotionCell(sym, reelIndex, i))}
        </div>
      </div>
    </div>
  );
}
