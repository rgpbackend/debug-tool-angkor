import type { GameSymbol } from "../../../ws/protocol";
import { getSymbolImage } from "../assets/symbols";

interface PaytableModalProps {
  open: boolean;
  symbols: GameSymbol[];
  onClose: () => void;
}

const SYMBOL_ORDER = ["A", "B", "C", "D", "E", "F", "G", "W"];

export default function PaytableModal({ open, symbols, onClose }: PaytableModalProps) {
  if (!open) return null;
  const map = new Map(symbols.map((s) => [s.id, s]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="paytable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paytable-header">
          <h2 className="paytable-title">PAYTABLE</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="paytable-grid">
          {SYMBOL_ORDER.map((id) => {
            const sym = map.get(id);
            const payouts = sym?.payouts;
            const isWild = sym?.substitutes === true;
            const imgSrc = getSymbolImage(id);
            return (
              <div key={id} className={`paytable-row${isWild ? " paytable-wild" : ""}`}>
                <span className="paytable-symbol">
                  {imgSrc ? (
                    <img src={imgSrc} alt={id} className="paytable-symbol-img" />
                  ) : (
                    id
                  )}
                </span>
                {isWild ? (
                  <span className="paytable-wild-desc">Substitutes all symbols. Expands on reels 2-4.</span>
                ) : (
                  <div className="paytable-payouts">
                    <span>3: {payouts?.["3"] ? `${payouts["3"]}x` : "—"}</span>
                    <span>4: {payouts?.["4"] ? `${payouts["4"]}x` : "—"}</span>
                    <span>5: {payouts?.["5"] ? `${payouts["5"]}x` : "—"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
