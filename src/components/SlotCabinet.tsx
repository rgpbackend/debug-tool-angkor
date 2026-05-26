import type { ReactNode } from "react";
import SlotConsoleBalance from "./SlotConsoleBalance";
import SlotControls from "./SlotControls";

type SlotCabinetProps = {
  celebrations?: ReactNode;
  reels: ReactNode | null;
  emptyMessage?: string | null;
  betValue: string;
  betLevels: string[];
  onBetChange: (value: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  /** Spin / Manual cluster; defaults to {@link canSpin}. */
  canSpinControls?: boolean;
  spinning: boolean;
  onSpin: () => void;
  onManualSpin: () => void;
  autoSpinActive: boolean;
  onAutoSpinStart: () => void;
  onAutoSpinStop: () => void;
  balance?: string | null;
  balanceConnected?: boolean;
  canDeposit?: boolean;
  depositBusy?: boolean;
  onDeposit?: () => void;
  onOpenHistory?: () => void;
  onOpenJackpot?: () => void;
  jackpotPools?: ReactNode;
  statusError?: string | null;
};

export default function SlotCabinet({
  celebrations,
  reels,
  emptyMessage,
  betValue,
  betLevels,
  onBetChange,
  betDisabled,
  canSpin,
  canSpinControls = canSpin,
  spinning,
  onSpin,
  onManualSpin,
  autoSpinActive,
  onAutoSpinStart,
  onAutoSpinStop,
  balance = null,
  balanceConnected = false,
  canDeposit = false,
  depositBusy = false,
  onDeposit,
  onOpenHistory,
  onOpenJackpot,
  jackpotPools,
  statusError,
}: Readonly<SlotCabinetProps>) {
  const hasReels = reels != null && emptyMessage == null;

  return (
    <div className="slot-cabinet">
      <div
        className="slot-cabinet-frame slot-stage-surface"
        aria-label="Slot machine"
      >
        {statusError ? (
          <div className="slot-cabinet-alerts">
            <div className="slot-status-bar">
              <span className="error slot-error">{statusError}</span>
            </div>
          </div>
        ) : null}

        <div className="slot-cabinet-body">
          <div className="slot-reel-window slot-reel-window--stacked">
            <div className="slot-reel-window-main">
              {hasReels ? (
                reels
              ) : (
                <p className="slot-empty">{emptyMessage ?? "Spin to play"}</p>
              )}
              {celebrations}
            </div>
            {jackpotPools ? (
              <div className="slot-reel-pools">{jackpotPools}</div>
            ) : null}
          </div>
        </div>

        <footer className="slot-cabinet-console">
          <div className="slot-console-bar">
            <div className="slot-console-leading">
              {onOpenHistory ? (
                <button
                  type="button"
                  className="slot-console-chip-btn"
                  onClick={onOpenHistory}
                >
                  History
                </button>
              ) : null}
              {onOpenJackpot ? (
                <button
                  type="button"
                  className="slot-console-chip-btn"
                  onClick={onOpenJackpot}
                >
                  Jackpot
                </button>
              ) : null}
              <button
                type="button"
                className={`slot-console-chip-btn slot-auto-spin-btn${autoSpinActive ? " slot-auto-spin-btn--stop" : ""}`}
                onClick={autoSpinActive ? onAutoSpinStop : onAutoSpinStart}
                disabled={!autoSpinActive && (betDisabled || !canSpin)}
                aria-pressed={autoSpinActive}
              >
                {autoSpinActive ? "Stop" : "Auto"}
              </button>
            </div>
            <SlotConsoleBalance
              balance={balance}
              connected={balanceConnected}
              canDeposit={canDeposit}
              depositBusy={depositBusy}
              onDeposit={onDeposit}
            />
            <SlotControls
              betValue={betValue}
              betLevels={betLevels}
              onBetChange={onBetChange}
              betDisabled={betDisabled}
              canSpin={canSpinControls}
              spinning={spinning}
              onSpin={onSpin}
              onManualSpin={onManualSpin}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
