import type { ReactNode } from "react";
import SlotConsoleBalance from "./SlotConsoleBalance";
import SlotConsoleCheat from "./SlotConsoleCheat";
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
  spinning: boolean;
  onSpin: () => void;
  canCheat?: boolean;
  cheatGridDirty?: boolean;
  balance?: string | null;
  balanceConnected?: boolean;
  onSetCheat?: () => void;
  onForceJackpot?: () => void;
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
  spinning,
  onSpin,
  canCheat = false,
  cheatGridDirty = false,
  balance = null,
  balanceConnected = false,
  onSetCheat,
  onForceJackpot,
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
            {onSetCheat && onForceJackpot ? (
              <SlotConsoleCheat
                canCheat={canCheat}
                cheatGridDirty={cheatGridDirty}
                onSetCheat={onSetCheat}
                onForceJackpot={onForceJackpot}
              />
            ) : null}
            <SlotConsoleBalance
              balance={balance}
              connected={balanceConnected}
            />
            <SlotControls
              betValue={betValue}
              betLevels={betLevels}
              onBetChange={onBetChange}
              betDisabled={betDisabled}
              canSpin={canSpin}
              spinning={spinning}
              onSpin={onSpin}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}
