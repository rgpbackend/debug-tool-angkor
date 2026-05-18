import { useCallback, useState } from "react";
import type { JackpotTier } from "../ws/protocol";
import ForceJackpotModal from "./ForceJackpotModal";

type SlotConsoleCheatProps = {
  canCheat: boolean;
  cheatGridDirty: boolean;
  forceJackpotBusy: boolean;
  onSetCheat: () => void;
  onForceJackpot: (tier: JackpotTier) => void | Promise<void>;
};

export default function SlotConsoleCheat({
  canCheat,
  cheatGridDirty,
  forceJackpotBusy,
  onSetCheat,
  onForceJackpot,
}: Readonly<SlotConsoleCheatProps>) {
  const [jackpotModalOpen, setJackpotModalOpen] = useState(false);

  const closeJackpotModal = useCallback(() => {
    if (!forceJackpotBusy) {
      setJackpotModalOpen(false);
    }
  }, [forceJackpotBusy]);

  const handleForceJackpotConfirm = useCallback(
    async (tier: JackpotTier) => {
      try {
        await onForceJackpot(tier);
        setJackpotModalOpen(false);
      } catch {
        /* error surfaced via session error state */
      }
    },
    [onForceJackpot],
  );

  return (
    <>
    <div className="slot-console-cheat">
      <div className="slot-console-cheat-buttons">
        <button
          type="button"
          className="primary slot-cheat-btn"
          onClick={onSetCheat}
          disabled={!canCheat || !cheatGridDirty}
          title={
            cheatGridDirty
              ? "Apply edited grid for next spin (2001)"
              : "Edit the reel grid first"
          }
        >
          Cheat Grid
        </button>
        <button
          type="button"
          className="primary slot-cheat-btn"
          onClick={() => setJackpotModalOpen(true)}
          disabled={!canCheat || forceJackpotBusy}
          title="Force jackpot on next base spin (2002)"
        >
          Cheat Jackpot
        </button>
      </div>
    </div>

      <ForceJackpotModal
        open={jackpotModalOpen}
        busy={forceJackpotBusy}
        canCheat={canCheat}
        onClose={closeJackpotModal}
        onConfirm={handleForceJackpotConfirm}
      />
    </>
  );
}
