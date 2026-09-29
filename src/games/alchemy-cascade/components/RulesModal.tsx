type RulesModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function RulesModal({ open, onClose }: RulesModalProps) {
  if (!open) return null;
  return (
    <div className="alchemy-modal-backdrop" onClick={onClose}>
      <div className="alchemy-paytable" onClick={(e) => e.stopPropagation()}>
        <div className="alchemy-paytable-head">
          <h2>Game Rule</h2>
          <button type="button" className="alchemy-lobby-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="alchemy-rules-body">
          <p>8×8 cluster pays. Five or more matching symbols connected horizontally or vertically win. Diagonals do not connect.</p>
          <p>Winning symbols are removed and new symbols tumble down until no clusters remain. All tumble wins are paid once when the chain ends.</p>
          <p>Payout = Total Bet × symbol multiplier. Wins are capped at 15000× total bet.</p>
          <p>Wild (W) substitutes for A–G.</p>
        </div>
      </div>
    </div>
  );
}
