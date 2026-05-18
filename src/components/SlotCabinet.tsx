import type { ReactNode } from "react";
import SlotControls from "./SlotControls";

type SlotCabinetProps = {
  banners?: ReactNode;
  reels: ReactNode | null;
  emptyMessage?: string | null;
  betValue: string;
  betLevels: string[];
  onBetChange: (value: string) => void;
  betDisabled: boolean;
  canSpin: boolean;
  spinning: boolean;
  onSpin: () => void;
  onOpenCheat?: () => void;
};

export default function SlotCabinet({
  banners,
  reels,
  emptyMessage,
  betValue,
  betLevels,
  onBetChange,
  betDisabled,
  canSpin,
  spinning,
  onSpin,
  onOpenCheat,
}: Readonly<SlotCabinetProps>) {
  const hasReels = reels != null && emptyMessage == null;

  return (
    <div className="slot-cabinet">
      <div
        className="slot-cabinet-frame slot-stage-surface"
        aria-label="Slot machine"
      >
        {banners ? (
          <div className="slot-cabinet-alerts">{banners}</div>
        ) : null}

        <div className="slot-cabinet-body">
          <div className="slot-reel-window">
            {hasReels ? (
              reels
            ) : (
              <p className="slot-empty">{emptyMessage ?? "Spin to play"}</p>
            )}
          </div>
        </div>

        <footer className="slot-cabinet-console">
          <div className="slot-console-bar">
            {onOpenCheat ? (
              <button
                type="button"
                className="cheat-fab cheat-fab--console"
                onClick={onOpenCheat}
                aria-label="Open cheat tools"
                title="Cheat tools (dev)"
              >
                <span className="cheat-fab-icon" aria-hidden>
                  ⚙
                </span>
              </button>
            ) : null}
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
