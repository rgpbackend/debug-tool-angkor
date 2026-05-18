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
}: Readonly<SlotCabinetProps>) {
  const hasReels = reels != null && emptyMessage == null;

  return (
    <div className="slot-cabinet">
      <div className="slot-cabinet-frame" aria-label="Slot machine">
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
          <SlotControls
            betValue={betValue}
            betLevels={betLevels}
            onBetChange={onBetChange}
            betDisabled={betDisabled}
            canSpin={canSpin}
            spinning={spinning}
            onSpin={onSpin}
          />
        </footer>
      </div>
    </div>
  );
}
