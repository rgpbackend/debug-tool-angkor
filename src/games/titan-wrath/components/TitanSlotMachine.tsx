import { useCallback, useRef, useState, type ReactNode } from "react";
import type { GameSymbol, JackpotPoolsByTier, ServerPayline } from "../../../ws/protocol";
import type { TitanPaylineWin, TitanWildSpinInfo } from "../titan-protocol";
import type { SpinPhase } from "../hooks/useSpinPhase";
import TitanReelGrid from "./TitanReelGrid";
import TitanPaylineOverlay from "./TitanPaylineOverlay";
import TitanWildExpansion from "./TitanWildExpansion";
import TitanJackpotBar from "./TitanJackpotBar";
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

  // Jackpot
  jackpotPoolsByTier: JackpotPoolsByTier;

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
}

export default function TitanSlotMachine(props: TitanSlotMachineProps) {
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const phase = props.spinPhase;
  const spinning = props.isSpinning;
  const showPaylines = phase === "paylines";
  const showWild = phase === "wild_expand";
  const showResult = phase === "result";
  const isBusy = phase !== "idle";

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
    ? `$${Number(props.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        <button className="titan-cabinet-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
          ☰
        </button>
      </header>

      {props.error && <div className="titan-error-banner">{props.error}</div>}

      <div className="titan-cabinet-status">
        {formattedBalance && (
          <>
            <span className="titan-status-label">Balance</span>
            <span className="titan-status-value">{formattedBalance}</span>
          </>
        )}
      </div>

      <TitanJackpotBar poolsByTier={props.jackpotPoolsByTier} />

      <div className="titan-grid-area" data-spinning={spinning ? "" : undefined}>
        <div className="titan-reel-stage">
          <TitanReelGrid
            patternGrid={props.patternGrid}
            lockedReels={props.lockedReels}
            spinning={spinning}
            onPresentationChange={handlePresentationChange}
          />
          <TitanPaylineOverlay
            paylines={props.serverPaylines}
            paylineWins={props.paylineWins}
            ready={paylinesReady}
          />
          <TitanWildExpansion
            wildInfo={showWild ? props.wildInfo : undefined}
            onComplete={handleWildDone}
          />
        </div>
      </div>

      <div className={`titan-cabinet-display${showResult && props.totalWin !== null && props.totalWin > 0 ? " display-win" : ""}`}>
        {renderDisplay()}
      </div>

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

      <PaytableModal
        open={paytableOpen}
        symbols={props.symbols}
        onClose={() => setPaytableOpen(false)}
      />
      <MenuPopover
        open={menuOpen}
        onOpenPaytable={() => setPaytableOpen(true)}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
