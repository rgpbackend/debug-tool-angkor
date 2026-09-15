import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { GameSymbol } from "../../../ws/protocol";
import { formatCreditAmount } from "../../../lib/session-utils";
import { BULLET_REEL_HEIGHTS } from "../bullet-protocol";
import {
  buildSpinStrip,
  buildUnifiedReelStrip,
  REEL_SPIN,
  type ReelVisualState,
} from "../lib/reel-spin";
import { useReelStripMotion } from "../hooks/useReelStripMotion";

interface BulletSlotMachineProps {
  reels: string[][];
  spinning: boolean;
  winSymbols: string[];
  symbols: GameSymbol[];
  balance: string | null;
  totalWin: string | null;
  betLevels: string[];
  selectBetValue: string;
  onBetChange: (bet: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  onSpin: () => void;
  onBackToLobby: () => void;
  error: string | null;
}

function symbolGlyph(id: string): { glyph: string; cls: string } {
  switch (id) {
    case "W":
      return { glyph: "W", cls: "bullet-cell--wild" };
    case "S":
      return { glyph: "☠", cls: "bullet-cell--scatter" };
    case "P":
      return { glyph: "★", cls: "bullet-cell--badge" };
    default:
      return { glyph: id.trim() ? id : "·", cls: "" };
  }
}

function kindClass(kind: string | undefined): string {
  switch (kind) {
    case "HIGH_PAY":
      return "bullet-cell--high";
    case "MID_PAY":
      return "bullet-cell--mid";
    case "LOW_PAY":
      return "bullet-cell--low";
    case "WILD":
    case "GOLDEN_WILD":
      return "bullet-cell--wild";
    case "SCATTER":
      return "bullet-cell--scatter";
    default:
      return "";
  }
}

type BulletReelColumnProps = {
  col: number;
  rows: number;
  /** Settled symbols before this spin (viewport start position). */
  originColumn: string[];
  column: string[];
  loopSegment: string[];
  reelState: ReelVisualState;
  bouncing: boolean;
  hitSymbols: Set<string>;
  kindById: Map<string, string | undefined>;
  onStopped: (col: number) => void;
};

function BulletReelColumn({
  col,
  rows,
  originColumn,
  column,
  loopSegment,
  reelState,
  bouncing,
  hitSymbols,
  kindById,
  onStopped,
}: BulletReelColumnProps) {
  // The landing result rides in the strip from the moment the payload arrives
  // (top cells sit off-viewport during cruise), so the stopping flip itself
  // swaps no content — no layer re-raster right at the decel start.
  const strip = useMemo(
    () => buildUnifiedReelStrip(originColumn, loopSegment, column),
    [originColumn, loopSegment, column],
  );
  const stripRef = useReelStripMotion({
    reelState,
    strip,
    onStopped: () => onStopped(col),
  });

  const colClass = [
    "bullet-reel",
    reelState === "spinning" ? "bullet-reel--spinning" : "",
    reelState === "stopping" ? "bullet-reel--stopping" : "",
    reelState === "stopped" && bouncing ? "bullet-reel--bounce" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const style = { "--rows": rows } as CSSProperties;

  const staticCell = (sym: string, ri: number) => {
    const { glyph, cls } = symbolGlyph(sym);
    const kind = kindById.get(sym);
    const hit = hitSymbols.has(sym) ? "bullet-cell--hit" : "";
    return (
      <div
        key={`${col}-${ri}`}
        className={["bullet-cell", cls, kindClass(kind), hit].filter(Boolean).join(" ")}
        aria-hidden="true"
      >
        {glyph}
      </div>
    );
  };

  if (reelState === "stopped" || reelState === "idle") {
    return (
      <div className={colClass} style={style}>
        {column.map((sym, ri) => staticCell(sym, ri))}
      </div>
    );
  }

  return (
    <div className={colClass} style={style}>
      <div ref={stripRef} className="bullet-reel-strip bullet-reel-strip--motion">
        {strip.symbols.map((sym, i) => {
          const { glyph, cls } = symbolGlyph(sym);
          return (
            <div
              key={`m-${i}`}
              className={["bullet-cell", "bullet-cell--motion", cls]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            >
              {glyph}
            </div>
          );
        })}
      </div>
      <div className="bullet-reel-shade" />
    </div>
  );
}

export default function BulletSlotMachine({
  reels,
  spinning,
  winSymbols,
  symbols,
  balance,
  totalWin,
  betLevels,
  selectBetValue,
  onBetChange,
  betDisabled,
  canSpin,
  onSpin,
  onBackToLobby,
  error,
}: BulletSlotMachineProps) {
  const [betPickerOpen, setBetPickerOpen] = useState(false);
  const [reelStates, setReelStates] = useState<ReelVisualState[]>(
    BULLET_REEL_HEIGHTS.map(() => "idle"),
  );
  const [bounces, setBounces] = useState<boolean[]>(
    BULLET_REEL_HEIGHTS.map(() => false),
  );
  const [origin, setOrigin] = useState<string[][]>([]);
  const [loopSegs, setLoopSegs] = useState<string[][]>([]);
  const [winFlash, setWinFlash] = useState(false);

  // Landing result for the current spin; "ready" once the 1500 payload arrives.
  const resultRef = useRef<string[][]>(reels);
  const resultReadyRef = useRef(true);
  const seenReelsRef = useRef(reels);
  const latestReelsRef = useRef(reels);

  useEffect(() => {
    if (seenReelsRef.current === reels) return;
    seenReelsRef.current = reels;
    latestReelsRef.current = reels;
    resultRef.current = reels;
    resultReadyRef.current = true;
  }, [reels]);

  // Rising edge of `spinning` bumps spinSeq; the theater runs off spinSeq so a
  // fast server response (isSpinning false again in ~300ms) cannot cancel it.
  const [spinSeq, setSpinSeq] = useState(0);
  const prevSpinningRef = useRef(false);
  useEffect(() => {
    if (spinning === prevSpinningRef.current) return;
    prevSpinningRef.current = spinning;
    if (spinning) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- theater starts on the spin event
      setSpinSeq((n) => n + 1);
    }
  }, [spinning]);

  // Spin theater: all reels cruise, then stop left → right once the result is in.
  useEffect(() => {
    if (spinSeq === 0) return;
    const reelsNow = latestReelsRef.current;
    setOrigin(reelsNow);
    setLoopSegs(
      BULLET_REEL_HEIGHTS.map(() => buildSpinStrip(REEL_SPIN.loopSegmentLength)),
    );
    setReelStates(BULLET_REEL_HEIGHTS.map(() => "spinning"));
    setWinFlash(false);
    resultRef.current = reelsNow;
    resultReadyRef.current = false;
    seenReelsRef.current = reelsNow;
    const timers: number[] = [];
    for (let i = 0; i < BULLET_REEL_HEIGHTS.length; i++) {
      timers.push(
        window.setTimeout(() => {
          const tryStop = () => {
            if (resultReadyRef.current) {
              setReelStates((prev) =>
                prev.map((s, j) => (j === i ? "stopping" : s)),
              );
            } else {
              timers.push(window.setTimeout(tryStop, 50));
            }
          };
          tryStop();
        }, REEL_SPIN.minSpinMs + i * REEL_SPIN.stopIntervalMs),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [spinSeq]);

  const handleReelStopped = useCallback((i: number) => {
    setReelStates((prev) => prev.map((s, j) => (j === i ? "stopped" : s)));
    setBounces((prev) => prev.map((b, j) => (j === i ? true : b)));
    window.setTimeout(
      () => setBounces((prev) => prev.map((b, j) => (j === i ? false : b))),
      REEL_SPIN.bounceMs,
    );
  }, []);

  const landed = reelStates.every((s) => s === "stopped");
  const winKey = winSymbols.join(",");
  useEffect(() => {
    if (!landed || !winKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flash starts when reels land
    setWinFlash(true);
    const t = window.setTimeout(() => setWinFlash(false), 1500);
    return () => window.clearTimeout(t);
  }, [landed, winKey]);

  const stepBet = useCallback(
    (dir: -1 | 1) => {
      const idx = betLevels.indexOf(selectBetValue);
      const next = idx + dir;
      if (next >= 0 && next < betLevels.length) onBetChange(betLevels[next]);
    },
    [betLevels, onBetChange, selectBetValue],
  );

  const betDisplay = `$${Number(selectBetValue).toFixed(2)}`;
  const winNum = totalWin != null ? Number(totalWin) : 0;
  const showWin = Number.isFinite(winNum) && winNum > 0;
  const busy = spinning || reelStates.some((s) => s === "spinning" || s === "stopping");
  const hitSymbols = useMemo(() => new Set(winFlash ? winSymbols : []), [winFlash, winSymbols]);
  const kindById = useMemo(
    () => new Map(symbols.map((s) => [s.id, s.kind])),
    [symbols],
  );

  return (
    <div className="bullet-cabinet">
      <header className="bullet-toolbar">
        <button type="button" className="bullet-lobby-btn" onClick={onBackToLobby}>
          Lobby
        </button>
        <div className="bullet-poster-name">
          <h1 className="bullet-title">Bullet and Bounty</h1>
          <p className="bullet-ways">Five reels, 3-4-4-4-3</p>
        </div>
      </header>

      <div className="bullet-hud">
        <div className="bullet-hud-item">
          <span className="bullet-hud-label">Balance</span>
          <span className="bullet-hud-value">
            {balance != null ? `$${formatCreditAmount(balance)}` : "—"}
          </span>
        </div>
        <div className="bullet-hud-item">
          <span className="bullet-hud-label">Win</span>
          <span className={`bullet-hud-value${showWin ? " bullet-hud-value--win" : ""}`}>
            {showWin ? `$${formatCreditAmount(totalWin!)}` : "$0.00"}
          </span>
        </div>
      </div>

      <div
        className="bullet-grid"
        role="img"
        aria-label="Bullet and Bounty reels 3-4-4-4-3"
      >
        {BULLET_REEL_HEIGHTS.map((height, col) => (
          <BulletReelColumn
            key={col}
            col={col}
            rows={height}
            originColumn={origin[col] ?? []}
            column={reels[col] ?? []}
            loopSegment={loopSegs[col] ?? []}
            reelState={reelStates[col]}
            bouncing={bounces[col]}
            hitSymbols={hitSymbols}
            kindById={kindById}
            onStopped={handleReelStopped}
          />
        ))}
      </div>

      <div className="bullet-ticker">
        {error
          ? error
          : busy
            ? "Reels running"
            : showWin
              ? `Win $${formatCreditAmount(totalWin!)}`
              : "Win up to 576 ways. Three scatters start free spins. Cap 13950×."}
      </div>

      <div className="bullet-controls">
        <div className="bullet-bet-controls">
          <button
            type="button"
            className="bullet-bet-btn"
            disabled={betDisabled}
            onClick={() => stepBet(-1)}
          >
            −
          </button>
          <button
            type="button"
            className="bullet-bet-display"
            disabled={betDisabled}
            onClick={() => !betDisabled && setBetPickerOpen(true)}
          >
            {betDisplay}
          </button>
          <button
            type="button"
            className="bullet-bet-btn"
            disabled={betDisabled}
            onClick={() => stepBet(1)}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className={`bullet-spin-btn${busy ? " bullet-spin-btn--busy" : ""}`}
          disabled={!canSpin || busy}
          onClick={() => {
            if (!busy) onSpin();
          }}
        >
          {busy ? "···" : "Spin"}
        </button>
      </div>

      {betPickerOpen ? (
        <div className="bullet-modal-backdrop" onClick={() => setBetPickerOpen(false)}>
          <div className="bullet-bet-picker" onClick={(e) => e.stopPropagation()}>
            <h3>Bet</h3>
            <div className="bullet-bet-picker-grid">
              {betLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`bullet-bet-option${level === selectBetValue ? " bullet-bet-option--on" : ""}`}
                  onClick={() => {
                    onBetChange(level);
                    setBetPickerOpen(false);
                  }}
                >
                  ${Number(level).toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
