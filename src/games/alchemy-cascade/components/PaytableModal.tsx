import type { GameSymbol } from "../../../ws/protocol";
import { formatAlchemyMoney } from "../lib/format";

type PaytableModalProps = {
  open: boolean;
  symbols: GameSymbol[];
  bet: string;
  onClose: () => void;
};

const BANDS: { key: string; label: string }[] = [
  { key: "5", label: "5" },
  { key: "6", label: "6" },
  { key: "7", label: "7" },
  { key: "8", label: "8" },
  { key: "9", label: "9–11" },
  { key: "12", label: "12–14" },
  { key: "15", label: "15–19" },
  { key: "20", label: "20–24" },
  { key: "25", label: "25+" },
];

function payoutAmount(multiplier: string | undefined, bet: number): string {
  if (!multiplier) return "—";
  const m = Number(multiplier);
  if (!Number.isFinite(m) || !Number.isFinite(bet)) return "—";
  return formatAlchemyMoney(String(m * bet));
}

export default function PaytableModal({ open, symbols, bet, onClose }: PaytableModalProps) {
  if (!open) return null;
  const betNum = Number(bet);

  return (
    <div className="alchemy-modal-backdrop" onClick={onClose}>
      <div className="alchemy-paytable" onClick={(e) => e.stopPropagation()}>
        <div className="alchemy-paytable-head">
          <h2>Paytable</h2>
          <button type="button" className="alchemy-lobby-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="alchemy-paytable-note">Payouts at current total bet {formatAlchemyMoney(bet)}.</p>
        <div className="alchemy-paytable-list">
          {symbols.map((sym) => (
              <div key={sym.id} className="alchemy-paytable-row">
                <div className="alchemy-paytable-sym">
                  <span>{sym.id}</span>
                </div>
                {sym.substitutes ? (
                  <p className="alchemy-paytable-wild">Wild — substitutes for A–G. Not drawn on base reels.</p>
                ) : (
                  <div className="alchemy-paytable-bands">
                    {BANDS.map((band) => (
                      <span key={band.key}>
                        {band.label}: {payoutAmount(sym.payouts?.[band.key], betNum)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
