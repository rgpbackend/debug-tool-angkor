import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXPECTED_CHEAT_REEL_SIZES } from "../lib/cheat";
import {
  REEL_SPIN,
  createSpinLoopSegment,
  initialReelStates,
  placeholderResult,
  spinningReelStates,
  type ReelVisualState,
} from "../lib/reel-spin";
import type { WinWay } from "../ws/protocol";
import SlotReelColumn from "./SlotReelColumn";

const REEL_COUNT = EXPECTED_CHEAT_REEL_SIZES.length;

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
  /** Server spin request in flight. */
  spinning?: boolean;
  /** Fired when reel presentation starts or finishes (spin + staggered stop). */
  onPresentationChange?: (active: boolean) => void;
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
  /** Cabinet editable: pending edits not yet sent. */
  cheatGridDirty?: boolean;
  /** Cabinet editable: cheat grid sent and armed for next spin. */
  cheatArmed?: boolean;
  canCheat?: boolean;
  onConfirmCheat?: () => void;
  onDiscardCheat?: () => void;
  /** Increments when a disallowed symbol key is entered. */
  cheatInputRejectTick?: number;
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
  spinning = false,
  onPresentationChange,
  editable = false,
  editGrid,
  editDisabled = false,
  onEditCellChange,
  cheatGridDirty = false,
  cheatArmed = false,
  canCheat = false,
  onConfirmCheat,
  onDiscardCheat,
  cheatInputRejectTick = 0,
}: Readonly<WinWayReelGridProps>) {
  const [cheatRejectActive, setCheatRejectActive] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [presentationActive, setPresentationActive] = useState(false);
  const [reelStates, setReelStates] = useState<ReelVisualState[]>(() =>
    initialReelStates(REEL_COUNT),
  );
  const [loopSegments, setLoopSegments] = useState<string[][]>([]);
  const [placeholderResults, setPlaceholderResults] = useState<string[][]>([]);
  const [spinOriginReels, setSpinOriginReels] = useState<string[][]>([]);
  const [bouncingReel, setBouncingReel] = useState<number | null>(null);

  const spinStartRef = useRef(0);
  const spinCycleRef = useRef(false);
  const stopScheduledRef = useRef(false);
  const stoppedReelsRef = useRef<Set<number>>(new Set());
  const stopTimersRef = useRef<number[]>([]);
  const bounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (cheatInputRejectTick === 0) {
      return;
    }
    queueMicrotask(() => setCheatRejectActive(true));
    const timer = window.setTimeout(() => setCheatRejectActive(false), 480);
    return () => window.clearTimeout(timer);
  }, [cheatInputRejectTick]);

  const clearStopTimers = useCallback(() => {
    stopTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    stopTimersRef.current = [];
  }, []);

  const finishPresentation = useCallback(() => {
    if (!spinCycleRef.current) {
      return;
    }
    clearStopTimers();
    spinCycleRef.current = false;
    stopScheduledRef.current = false;
    stoppedReelsRef.current.clear();
    setPresentationActive(false);
    onPresentationChange?.(false);
  }, [clearStopTimers, onPresentationChange]);

  const beginPresentation = useCallback(() => {
    clearStopTimers();
    spinCycleRef.current = true;
    stopScheduledRef.current = false;
    stoppedReelsRef.current.clear();
    spinStartRef.current = Date.now();
    setPresentationActive(true);
    onPresentationChange?.(true);
    setReelStates(spinningReelStates(REEL_COUNT));
    setSpinOriginReels(
      EXPECTED_CHEAT_REEL_SIZES.map((len, ci) => {
        const col = reels[ci] ?? [];
        return Array.from({ length: len }, (_, ri) => col[ri] ?? "");
      }),
    );
    setLoopSegments(
      EXPECTED_CHEAT_REEL_SIZES.map(() => createSpinLoopSegment()),
    );
    setPlaceholderResults(
      EXPECTED_CHEAT_REEL_SIZES.map((len) => placeholderResult(len)),
    );
    setBouncingReel(null);
  }, [clearStopTimers, onPresentationChange, reels]);

  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(0));
  }, [winWays]);

  useEffect(() => {
    if (!spinning || !cabinet) {
      return;
    }
    queueMicrotask(() => beginPresentation());
  }, [spinning, cabinet, beginPresentation]);

  useEffect(() => {
    if (spinning || !cabinet || !spinCycleRef.current || stopScheduledRef.current) {
      return;
    }

    stopScheduledRef.current = true;

    const elapsed = Date.now() - spinStartRef.current;
    const delayBeforeStop = Math.max(0, REEL_SPIN.minSpinMs - elapsed);

    clearStopTimers();

    const scheduleStop = window.setTimeout(() => {
      EXPECTED_CHEAT_REEL_SIZES.forEach((_, ci) => {
        const timer = window.setTimeout(() => {
          setReelStates((prev) => {
            if (prev[ci] !== "spinning") {
              return prev;
            }
            const next = [...prev];
            next[ci] = "stopping";
            return next;
          });
        }, ci * REEL_SPIN.stopIntervalMs);
        stopTimersRef.current.push(timer);
      });
    }, delayBeforeStop);

    stopTimersRef.current.push(scheduleStop);

    const fallbackFinishMs =
      delayBeforeStop +
      (REEL_COUNT - 1) * REEL_SPIN.stopIntervalMs +
      REEL_SPIN.stopDurationMs +
      REEL_SPIN.bounceMs +
      120;
    const fallbackTimer = window.setTimeout(() => {
      if (!spinCycleRef.current) {
        return;
      }
      setReelStates(EXPECTED_CHEAT_REEL_SIZES.map(() => "stopped"));
      finishPresentation();
    }, fallbackFinishMs);
    stopTimersRef.current.push(fallbackTimer);

    return clearStopTimers;
  }, [spinning, cabinet, reels, clearStopTimers, finishPresentation]);

  useEffect(
    () => () => {
      clearStopTimers();
      if (bounceTimerRef.current != null) {
        window.clearTimeout(bounceTimerRef.current);
      }
    },
    [clearStopTimers],
  );

  const handleReelStopped = useCallback(
    (ci: number) => {
      if (stoppedReelsRef.current.has(ci)) {
        return;
      }
      stoppedReelsRef.current.add(ci);

      setReelStates((prev) => {
        if (prev[ci] === "stopped") {
          return prev;
        }
        const next = [...prev];
        next[ci] = "stopped";
        return next;
      });

      setBouncingReel(ci);
      if (bounceTimerRef.current != null) {
        window.clearTimeout(bounceTimerRef.current);
      }
      bounceTimerRef.current = window.setTimeout(() => {
        setBouncingReel(null);
        bounceTimerRef.current = null;
      }, REEL_SPIN.bounceMs);

      if (stoppedReelsRef.current.size >= REEL_COUNT) {
        finishPresentation();
      }
    },
    [finishPresentation],
  );

  const showWinPresentation = cabinet ? !presentationActive && !spinning : true;
  const displayWinWays = useMemo(
    () => (showWinPresentation ? winWays : []),
    [showWinPresentation, winWays],
  );
  const displayGoldenWild = showWinPresentation
    ? goldenWildHighlightKeys
    : undefined;

  const safeSelectedIndex =
    displayWinWays.length === 0
      ? 0
      : Math.min(Math.max(selectedIndex, 0), displayWinWays.length - 1);

  const fullCellWinWays = useMemo(
    () => buildCellWinWayMap(displayWinWays),
    [displayWinWays],
  );
  const cellWinWays = useMemo(
    () => filterCellWinWayMap(fullCellWinWays, safeSelectedIndex),
    [fullCellWinWays, safeSelectedIndex],
  );

  const selectedColor = winWayColor(safeSelectedIndex);

  const layoutClass = cabinet
    ? "winway-reels-layout winway-reels-layout--cabinet"
    : "winway-reels-layout";

  const showLegendSlot = cabinet || displayWinWays.length > 0;
  const reelsBusy = spinning || presentationActive;

  const featureHud =
    respinVisible || freeSpinVisible ? (
      <div className="slot-reels-hud">
        <div className="slot-reels-hud-status-cluster">
          {freeSpinVisible ? (
            <div className="slot-reels-hud-freespin-row">
              <div
                className="slot-scatter-tracker"
                title="Collect scatters during free spins"
                role="img"
                aria-label={`${freeSpinScatterCollected} of ${freeSpinScatterTarget} scatters collected`}
              >
                <div className="slot-scatter-tracker-slots">
                  {Array.from({ length: freeSpinScatterTarget }, (_, index) => {
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
                  })}
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
        </div>
      </div>
    ) : null;

  return (
    <div className={layoutClass}>
      {showLegendSlot ? (
        <aside
          className={`winway-legend-panel${cabinet && displayWinWays.length === 0 ? " winway-legend-panel--empty" : ""}`}
          aria-label="Win ways legend"
        >
          {cabinet ? (
            <p className="winway-legend-heading">Win ways</p>
          ) : null}
          {displayWinWays.length > 0 ? (
            <ul
              className="winway-legend"
              role="listbox"
              aria-label="Select win way"
            >
              {displayWinWays.map((way, idx) => {
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
              {reelsBusy ? "Spinning…" : "No win ways this spin"}
            </p>
          )}
        </aside>
      ) : null}

      {cabinet ? featureHud : null}

      <div className="reels-wrap winway-reels-main slot-reels-stage">
        {!cabinet ? featureHud : null}
        <div className="slot-reels-grid-anchor">
        <div
          className={`reels reels--5${editable ? " reels--editable" : ""}${
            cheatArmed ? " reels--cheat-armed" : ""
          }${cheatRejectActive ? " reels--cheat-reject" : ""}${
            reelsBusy ? " reels--busy" : ""
          }`}
          aria-label={ariaLabel}
          aria-busy={reelsBusy}
        >
          {EXPECTED_CHEAT_REEL_SIZES.map((colLen, ci) => {
            const column = reels[ci] ?? [];
            const originColumn =
              spinOriginReels[ci] ??
              Array.from({ length: colLen }, (_, ri) => column[ri] ?? "");
            const visualState = cabinet ? reelStates[ci] : "idle";

            if (!cabinet) {
              return (
                <SlotReelColumn
                  key={`reel-r${ci + 1}-cells-${colLen}`}
                  reelIndex={ci}
                  colLen={colLen}
                  originColumn={originColumn}
                  column={column}
                  loopSegment={[]}
                  motionResult={[]}
                  reelState="idle"
                  bouncing={false}
                  editable={editable}
                  editGrid={editGrid}
                  editDisabled={editDisabled}
                  showWinPresentation={showWinPresentation}
                  cellWinWays={cellWinWays}
                  goldenWildHighlightKeys={displayGoldenWild}
                  selectedColor={selectedColor}
                  onEditCellChange={onEditCellChange}
                  onReelStopped={handleReelStopped}
                />
              );
            }

            return (
              <SlotReelColumn
                key={`reel-r${ci + 1}-cells-${colLen}`}
                reelIndex={ci}
                colLen={colLen}
                originColumn={originColumn}
                column={column}
                loopSegment={loopSegments[ci] ?? []}
                motionResult={placeholderResults[ci] ?? []}
                reelState={visualState}
                bouncing={bouncingReel === ci}
                editable={editable}
                editGrid={editGrid}
                editDisabled={editDisabled || reelsBusy}
                showWinPresentation={showWinPresentation}
                cellWinWays={cellWinWays}
                goldenWildHighlightKeys={displayGoldenWild}
                selectedColor={selectedColor}
                onEditCellChange={onEditCellChange}
                onReelStopped={handleReelStopped}
              />
            );
          })}
        </div>
        {editable && cheatGridDirty ? (
          <div className="cheat-edit-actions" role="group" aria-label="Cheat grid edits">
            <button
              type="button"
              className="cheat-edit-btn cheat-edit-btn--discard"
              aria-label="Discard cheat edits"
              disabled={editDisabled || reelsBusy}
              onClick={onDiscardCheat}
            >
              <span aria-hidden>×</span>
            </button>
            <button
              type="button"
              className="cheat-edit-btn cheat-edit-btn--confirm"
              aria-label="Apply cheat grid"
              disabled={!canCheat || editDisabled || reelsBusy}
              onClick={onConfirmCheat}
            >
              <span aria-hidden>✓</span>
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
