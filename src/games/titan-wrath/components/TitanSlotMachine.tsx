import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { GameSymbol, ServerPayline, JackpotTierEntry } from "../../../ws/protocol";
import type { TitanPaylineWin, TitanWildSpinInfo, TitanJackpotTier, TitanJackpotTriggered } from "../titan-protocol";
import type { SpinPhase } from "../hooks/useSpinPhase";
import TitanReelGrid from "./TitanReelGrid";
import TitanPaylineOverlay from "./TitanPaylineOverlay";
import TitanWildExpansion from "./TitanWildExpansion";
import TitanJackpotMeter from "./TitanJackpotMeter";
import TitanJackpotCelebration from "./TitanJackpotCelebration";
import TitanControls from "./TitanControls";
import PaytableModal from "./PaytableModal";
import MenuPopover from "./MenuPopover";

interface TitanSlotMachineProps {
  // Grid
  patternGrid: string;
  lockedReels: number[];
  spinPhase: SpinPhase;
  isSpinning: boolean;
  onPresentationChange?: (active: boolean) => void;

  // Paylines
  serverPaylines: ServerPayline[];
  paylineWins: TitanPaylineWin[];

  // Wild expansion
  wildInfo: TitanWildSpinInfo | undefined;
  wildAnimDone: () => void;

  // Display
  totalWin: number | null;

  // Controls
  betLevels: string[];
  selectBetValue: string;
  onBetChange: (bet: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  onSpin: () => void;
  autoSpinActive: boolean;
  autoSpinCount: number | null;
  onAutoSpinStart: (count: number) => void;
  onAutoSpinStop: () => void;
  superBetActive: boolean;
  superBetToggleable: boolean;
  onSuperBetToggle: (v: boolean) => void;

  // Meta
  error: string | null;
  symbols: GameSymbol[];

  // Balance
  balance: string | null;

  // Toolbar
  toolbarSlot?: ReactNode;

  // Olympus Jackpot
  tokenPositions: number[];
  roundId: string;
  jackpotMeterTokens: number;
  jackpotMeterTier: TitanJackpotTier | null;
  jackpotTierConfig: JackpotTierEntry[];
  lastJackpotWin: TitanJackpotTriggered | null;
  onDismissJackpot: () => void;
  // Menu
  onOpenHistory: () => void;
  onOpenJackpotWinners: () => void;
}

export default function TitanSlotMachine(props: TitanSlotMachineProps) {
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const phase = props.spinPhase;
  const spinning = props.isSpinning;
  const showWild = phase === "wild_expand";
  const showResult = phase === "result";
  const isBusy = phase !== "idle";

  // --- Token animation state machine ---
  // idle → appear → flying → done → idle
  type TokenFlyState = "idle" | "appear" | "flying" | "done";
  const [tokenFlyState, setTokenFlyState] = useState<TokenFlyState>("idle");
  const tokensVisible = phase !== "idle" && phase !== "spinning";
  const hasTokens = props.tokenPositions.length > 0;
  const [displayTokenCount, setDisplayTokenCount] = useState(0);

  // Timers stored in refs — never killed by React cleanup during normal transitions.
  const flyTimerRef = useRef<number | null>(null);
  const doneTimerRef = useRef<number | null>(null);

  function killTimers() {
    if (flyTimerRef.current !== null) { window.clearTimeout(flyTimerRef.current); flyTimerRef.current = null; }
    if (doneTimerRef.current !== null) { window.clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
  }

  // Final cleanup on unmount
  useEffect(() => () => killTimers(), []);

  // Reset on new round
  const prevRoundIdRef = useRef(props.roundId);
  useEffect(() => {
    if (props.roundId && props.roundId !== prevRoundIdRef.current) {
      prevRoundIdRef.current = props.roundId;
      killTimers();
      setDisplayTokenCount(0);
      setTokenFlyState("idle");
    }
  }, [props.roundId]);

  // Main animation sequencer. Only clears timers when interrupted
  // (tokensVisible → false), NOT on normal state transitions.
  const prevJackpotTokensRef = useRef(props.jackpotMeterTokens);
  useEffect(() => {
    const newTokensArrived = props.jackpotMeterTokens > prevJackpotTokensRef.current;
    prevJackpotTokensRef.current = props.jackpotMeterTokens;

    if (!tokensVisible || !hasTokens) {
      // Sequence interrupted or not started
      if (tokenFlyState !== "idle") killTimers();
      if (tokenFlyState === "done") setTokenFlyState("idle");
      return;
    }

    // New tokens arrived from a respin while previous animation completed → restart
    if (newTokensArrived && tokenFlyState === "done") {
      killTimers();
      setTokenFlyState("idle");
      return; // re-render with idle → starts new sequence
    }

    // --- Normal state transitions (no timer cleanup) ---

    if (tokenFlyState === "idle") {
      setTokenFlyState("appear");
      flyTimerRef.current = window.setTimeout(() => {
        flyTimerRef.current = null;
        setTokenFlyState("flying");
      }, 700);
      return;
    }

    if (tokenFlyState === "flying") {
      doneTimerRef.current = window.setTimeout(() => {
        doneTimerRef.current = null;
        setDisplayTokenCount(props.jackpotMeterTokens);
        setTokenFlyState("done");
      }, 500);
      return;
    }

    // "appear" or "done" — wait for timer or external change
  }, [tokensVisible, hasTokens, tokenFlyState, props.jackpotMeterTokens]);

  const tokensFlying = tokenFlyState === "flying";
  const tokenCountForMeter = (tokenFlyState === "done" || tokenFlyState === "idle")
    ? displayTokenCount
    : displayTokenCount;
  const meterImpact = tokenFlyState === "flying" ? props.tokenPositions.length : 0;

  // Paylines show only after reels have fully stopped (phase past "spinning")
  const paylinesReady = phase !== "spinning" && props.paylineWins.length > 0;


  const onPresentationChangeRef = useRef(props.onPresentationChange);
  onPresentationChangeRef.current = props.onPresentationChange;

  const handlePresentationChange = useCallback((active: boolean) => {
    onPresentationChangeRef.current?.(active);
  }, []);

  const handleWildDone = useCallback(() => {
    props.wildAnimDone();
  }, [props.wildAnimDone]);

  const formattedBalance = props.balance !== null
    ? `$${Number(props.balance).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
    : null;

  // What to show in the display box
  const renderDisplay = () => {
    // Result phase: show total win
    if (showResult && props.totalWin !== null && props.totalWin > 0) {
      return <span className="titan-win-amount" key={props.totalWin}>${props.totalWin.toFixed(2)}</span>;
    }
    // Busy — ellipsis
    if (isBusy) {
      return <span className="titan-display-muted">…</span>;
    }
    // Idle
    return <span className="titan-display-muted">Win up to 2100x Bet</span>;
  };

  return (
    <div className="titan-slot-machine">
      {/* Header */}
      <header className="titan-cabinet-header">
        <div className="titan-cabinet-toolbar">
          {props.toolbarSlot}
        </div>
        <span className="titan-cabinet-title">⚡ Titan&apos;s Wrath</span>
        {formattedBalance && (
          <span className="titan-header-balance">{formattedBalance}</span>
        )}
        <button type="button" className="titan-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
          ☰
        </button>
      </header>

      <div className="titan-game-body">
        <div className="titan-sidebar titan-sidebar--left">
          <TitanJackpotMeter
            tokenCount={tokenCountForMeter}
            impactNew={meterImpact}
            reachedTier={props.jackpotMeterTier}
            tierConfig={props.jackpotTierConfig}
            baseBet={Number(props.selectBetValue) || 0}
          />
        </div>

        <div className="titan-grid-area" data-spinning={spinning ? "" : undefined}>
          <div className="titan-reel-stage">
            <div className="titan-reel-container">
              <TitanReelGrid
                patternGrid={props.patternGrid}
                lockedReels={props.lockedReels}
                spinning={spinning}
                onPresentationChange={handlePresentationChange}
                tokenPositions={props.tokenPositions}
                tokensVisible={tokensVisible}
                tokensFlying={tokensFlying}
              />
              <TitanPaylineOverlay
                paylines={props.serverPaylines}
                paylineWins={props.paylineWins}
                ready={paylinesReady}
              />
            </div>
            <TitanWildExpansion
              wildInfo={showWild ? props.wildInfo : undefined}
              onComplete={handleWildDone}
            />
          </div>
        </div>

        <div className="titan-sidebar titan-sidebar--right">
          <TitanControls
            betLevels={props.betLevels}
            selectBetValue={props.selectBetValue}
            onBetChange={props.onBetChange}
            betDisabled={props.betDisabled}
            canSpin={props.canSpin}
            spinning={isBusy}
            onSpin={props.onSpin}
            autoSpinActive={props.autoSpinActive}
            autoSpinCount={props.autoSpinCount}
            onAutoSpinStart={props.onAutoSpinStart}
            onAutoSpinStop={props.onAutoSpinStop}
            superBetActive={props.superBetActive}
            superBetToggleable={props.superBetToggleable}
            onSuperBetToggle={props.onSuperBetToggle}
          />
        </div>
      </div>

      <div className={`titan-cabinet-display${showResult && props.totalWin !== null && props.totalWin > 0 ? " display-win" : ""}`}>
        {renderDisplay()}
      </div>

      <PaytableModal
        open={paytableOpen}
        symbols={props.symbols}
        onClose={() => setPaytableOpen(false)}
      />
      <MenuPopover
        open={menuOpen}
        onOpenPaytable={() => setPaytableOpen(true)}
        onOpenHistory={props.onOpenHistory}
        onOpenJackpotWinners={props.onOpenJackpotWinners}
        onClose={() => setMenuOpen(false)}
      />
      <TitanJackpotCelebration
        tier={props.lastJackpotWin?.tier ?? null}
        prizeAmount={props.lastJackpotWin?.prizeAmount ?? 0}
        tokenCount={props.lastJackpotWin?.tokenCount ?? 0}
        tierConfig={props.jackpotTierConfig}
        onDismiss={props.onDismissJackpot}
      />
    </div>
  );
}
