import { useCallback, useRef, useState, type ReactNode } from "react";
import type { GameSymbol, JackpotPoolsByTier, ServerPayline } from "../../../ws/protocol";
import type { TitanPaylineWin, TitanWildSpinInfo } from "../titan-protocol";
import type { SpinPhase } from "../hooks/useSpinPhase";
import TitanReelGrid from "./TitanReelGrid";
import TitanPaylineOverlay from "./TitanPaylineOverlay";
import TitanWildExpansion from "./TitanWildExpansion";
import TitanDisplayBox from "./TitanDisplayBox";
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

  const onPresentationChangeRef = useRef(props.onPresentationChange);
  onPresentationChangeRef.current = props.onPresentationChange;

  const handlePresentationChange = useCallback((active: boolean) => {
    onPresentationChangeRef.current?.(active);
  }, []);

  const handleWildDone = useCallback(() => {
    props.wildAnimDone();
  }, [props.wildAnimDone]);

  return (
    <div className="titan-slot-machine">
      {/* Toolbar */}
      {props.toolbarSlot && (
        <div className="titan-toolbar">{props.toolbarSlot}</div>
      )}

      {/* Error */}
      {props.error && <div className="titan-error-banner">{props.error}</div>}

      {/* Balance */}
      {props.balance !== null && (
        <div className="titan-balance-row">
          <span className="balance-label">BALANCE</span>
          <span className="balance-amount">
            ${Number(props.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Jackpot Bar */}
      <TitanJackpotBar poolsByTier={props.jackpotPoolsByTier} />

      {/* Grid Area */}
      <div className="titan-grid-area" data-spinning={spinning ? "" : undefined}>
        <TitanReelGrid
          patternGrid={props.patternGrid}
          lockedReels={props.lockedReels}
          spinning={spinning}
          onPresentationChange={handlePresentationChange}
        />


        <TitanPaylineOverlay
          paylines={props.serverPaylines}
          paylineWins={props.paylineWins}
          visible={showPaylines}
        />

        <TitanWildExpansion
          wildInfo={showWild ? props.wildInfo : undefined}
          onComplete={handleWildDone}
        />

      </div>

      {/* Display Box */}
      <TitanDisplayBox
        spinning={isBusy}
        totalWin={showResult ? props.totalWin : null}
      />

      {/* Controls */}
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

      {/* Menu button (floating) */}
      <button className="titan-menu-btn" onClick={() => setMenuOpen(true)}>
        ☰
      </button>

      {/* Modals */}
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
