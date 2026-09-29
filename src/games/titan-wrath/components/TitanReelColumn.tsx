import { useMemo, type CSSProperties } from "react";
import { useReelStripMotion } from "../hooks/useReelStripMotion";
import {
  buildUnifiedReelStrip,
  type ReelVisualState,
} from "../lib/reel-spin";
import { getSymbolImage } from "../assets/symbols";

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
  /** Rows in this column that have a divine token. */
  tokenRows?: Set<number>;
  /** Whether to show token indicators. */
  tokensVisible?: boolean;
  /** Whether tokens are in fly-to-meter animation. */
  tokensFlying?: boolean;
  /** symbolId → CSS class, derived from server GameSymbol.kind */
  symbolTierClass?: Record<string, string>;
};

function renderCell(
  sym: string,
  reelIndex: number,
  rowIndex: number,
  hasToken: boolean,
  isFlying: boolean,
  tierClass: string,
) {
  const displaySym = sym || "·";
  const imgSrc = sym ? getSymbolImage(sym) : undefined;
  const cellClass = [
    "cell",
    "titan-symbol-cell",
    sym ? tierClass : "cell--empty",
    hasToken ? "cell-has-token" : "",
  ].filter(Boolean).join(" ");

  const badgeClass = [
    "divine-token-badge",
    isFlying ? "token-flying" : "",
  ].filter(Boolean).join(" ");

  return (
    <div key={`r${reelIndex}-row${rowIndex}`} className={cellClass}>
      {imgSrc ? (
        <img src={imgSrc} alt={sym} className="titan-symbol-img" />
      ) : (
        <span className="titan-symbol-text">{displaySym}</span>
      )}
      {hasToken && (
        <div className={badgeClass} aria-hidden>
          <span className="divine-token-icon-inner">⚡</span>
        </div>
      )}
    </div>
  );
}

function renderMotionCell(sym: string, reelIndex: number, stripIndex: number, tierClass: string) {
  const displaySym = sym || "·";
  const imgSrc = sym ? getSymbolImage(sym) : undefined;
  return (
    <div key={`r${reelIndex}-m${stripIndex}`} className={`cell titan-symbol-cell cell--motion ${sym ? tierClass : "cell--empty"}`}>
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
  tokenRows,
  tokensVisible,
  tokensFlying = false,
  symbolTierClass = {},
}: Readonly<TitanReelColumnProps>) {
  const showTokens = !!(tokensVisible && tokenRows && tokenRows.size > 0);
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
        {column.map((sym, ri) => {
          const hasToken = !!(showTokens && (tokenRows?.has(ri) ?? false));
          return renderCell(sym, reelIndex, ri, hasToken, hasToken && tokensFlying, symbolTierClass[sym] ?? "");
        })}
      </div>
    );
  }

  // Spinning or stopping: show motion strip
  return (
    <div className={reelColClass} style={reelColStyle}>
      <div className="reel-viewport">
        <div ref={stripRef} className="reel-strip reel-strip--motion">
          {motionStrip.symbols.map((sym, i) => renderMotionCell(sym, reelIndex, i, symbolTierClass[sym] ?? ""))}
        </div>
      </div>
    </div>
  );
}
