import type { GameSymbol } from "../../../ws/protocol";
import { getSymbolImage } from "../assets/symbols";

interface PaytableModalProps {
  open: boolean;
  symbols: GameSymbol[];
  onClose: () => void;
}

const KIND_ORDER: Record<string, number> = {
  HIGH_PAY: 0,
  MID_PAY: 1,
  LOW_PAY: 2,
};

export default function PaytableModal({ open, symbols, onClose }: PaytableModalProps) {
  if (!open) return null;

  // Sort by kind (HIGH → MID → LOW), wild/scatter last
  const ordered = [...symbols].sort((a, b) => {
    const ao = KIND_ORDER[a.kind ?? ""] ?? 3;
    const bo = KIND_ORDER[b.kind ?? ""] ?? 3;
    return ao - bo || a.id.localeCompare(b.id);
  });
  const map = new Map(symbols.map((s) => [s.id, s]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="paytable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paytable-header">
          <h2 className="paytable-title">PAYTABLE</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="paytable-grid">
          {ordered.map(({ id }) => {
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

        {/* Multiplier Rules */}
        <div className="paytable-rules">
          <h3 className="paytable-rules-title">Multiplier Rules</h3>

          <div className="paytable-rule">
            <span className="paytable-rule-icon">⚡</span>
            <div>
              <strong>Titan's Wrath</strong>
              <p>Any <strong>5-of-a-kind</strong> win is multiplied by <strong>×4</strong>, regardless of Wild columns. This is the highest-priority multiplier.</p>
            </div>
          </div>

          <div className="paytable-rule">
            <span className="paytable-rule-icon">🔥</span>
            <div>
              <strong>Titan Multiplier</strong>
              <p>When a payline passes through expanded Wild columns on a 3 or 4-of-a-kind win:</p>
              <ul className="paytable-rule-list">
                <li>3 matching, 1 Wild column → <strong>×2</strong></li>
                <li>4 matching, 1 Wild column → <strong>×2</strong></li>
                <li>4 matching, 2 Wild columns → <strong>×3</strong></li>
              </ul>
            </div>
          </div>

          <div className="paytable-rule">
            <span className="paytable-rule-icon">🏺</span>
            <div>
              <strong>Olympus Jackpot</strong>
              <p>Divine Tokens randomly appear on the grid. Collect them in the Jackpot Meter to win multiplier prizes at round end.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
