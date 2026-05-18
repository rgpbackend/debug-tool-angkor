import { useEffect, useState } from "react";
import {
  isStaticJackpotTier,
  JACKPOT_TIERS,
  type JackpotTier,
} from "../ws/protocol";

const TIER_LABELS: Record<JackpotTier, string> = {
  NANO: "Nano",
  CYBER: "Cyber",
  GUARDIAN: "Guardian",
  ETERNAL: "Eternal",
};

export type ForceJackpotModalProps = {
  open: boolean;
  busy: boolean;
  canCheat: boolean;
  onClose: () => void;
  onConfirm: (tier: JackpotTier) => void | Promise<void>;
};

export default function ForceJackpotModal({
  open,
  busy,
  canCheat,
  onClose,
  onConfirm,
}: Readonly<ForceJackpotModalProps>) {
  const [selectedTier, setSelectedTier] = useState<JackpotTier | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedTier(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || busy) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) {
    return null;
  }

  const handleConfirm = () => {
    if (!selectedTier || busy || !canCheat) {
      return;
    }
    void onConfirm(selectedTier);
  };

  return (
    <div className="cheat-modal-root force-jackpot-modal-root" role="presentation">
      <button
        type="button"
        className="cheat-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
        disabled={busy}
      />
      <div
        className="cheat-modal panel force-jackpot-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-jackpot-modal-title"
      >
        <header className="cheat-modal-header">
          <h2 id="force-jackpot-modal-title">Cheat jackpot</h2>
          <button
            type="button"
            className="cheat-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="cheat-hint muted">
          Chọn loại jackpot — lượt <strong>base spin</strong> tiếp theo sẽ thắng
          chắc chắn tier đó (cmd <code>2002</code>).
        </p>

        <div
          className="force-jackpot-tier-grid"
          role="listbox"
          aria-label="Jackpot tier"
        >
          {JACKPOT_TIERS.map((tier) => {
            const isStatic = isStaticJackpotTier(tier);
            const selected = selectedTier === tier;
            return (
              <button
                key={tier}
                type="button"
                role="option"
                aria-selected={selected}
                className={`force-jackpot-tier-option jackpot-pool-card jackpot-pool-${tier.toLowerCase()}${selected ? " force-jackpot-tier-option--selected" : ""}`}
                disabled={!canCheat || busy}
                onClick={() => setSelectedTier(tier)}
              >
                <span className="jackpot-pool-tier">{TIER_LABELS[tier]}</span>
                <span className="force-jackpot-tier-kind muted">
                  {isStatic ? "Fixed prize" : "Progressive"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="row cheat-modal-actions force-jackpot-modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleConfirm}
            disabled={!canCheat || busy || selectedTier === null}
          >
            {busy ? "Arming…" : "Arm next spin"}
          </button>
        </div>
      </div>
    </div>
  );
}
