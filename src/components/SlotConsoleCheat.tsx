type SlotConsoleCheatProps = {
  canCheat: boolean;
  cheatGridDirty: boolean;
  onSetCheat: () => void;
  onForceJackpot: () => void;
};

export default function SlotConsoleCheat({
  canCheat,
  cheatGridDirty,
  onSetCheat,
  onForceJackpot,
}: Readonly<SlotConsoleCheatProps>) {
  return (
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
          onClick={onForceJackpot}
          disabled={!canCheat}
          title="Force jackpot on next spin (2002)"
        >
          Cheat Jackpot
        </button>
      </div>
    </div>
  );
}
