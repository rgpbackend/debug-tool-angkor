import { useCallback, useEffect, useMemo } from "react";

type JackpotTier = "MINI" | "MINOR" | "MAJOR" | "GRAND";

interface TitanJackpotCelebrationProps {
  tier: JackpotTier | null;
  prizeAmount: number;
  tokenCount: number;
  onDismiss: () => void;
}

const TIER_CONFIG: Record<JackpotTier, { label: string; multiplier: number; cssTier: string }> = {
  MINI:  { label: "Mini Jackpot",  multiplier: 10,   cssTier: "tier-mini" },
  MINOR: { label: "Minor Jackpot", multiplier: 50,   cssTier: "tier-minor" },
  MAJOR: { label: "Major Jackpot", multiplier: 200,  cssTier: "tier-major" },
  GRAND: { label: "Grand Jackpot", multiplier: 1000, cssTier: "tier-grand" },
};

/** Generate random spark positions — deterministic per render so they don't jump. */
function sparkStyle(i: number): React.CSSProperties {
  // Use prime offsets for pseudo-random but stable distribution
  const left = ((i * 17 + 3) % 100);
  const delay = ((i * 7 + 1) % 15) / 10;
  const size = 2 + (i % 3);
  return {
    left: `${left}%`,
    bottom: `${10 + (i * 11) % 70}%`,
    width: size,
    height: size,
    animationDelay: `${delay}s`,
  };
}

export default function TitanJackpotCelebration({
  tier,
  prizeAmount,
  tokenCount: _tokenCount,
  onDismiss,
}: TitanJackpotCelebrationProps) {
  // Auto-dismiss after 5s
  useEffect(() => {
    if (!tier) return;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [tier, onDismiss]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onDismiss();
    },
    [onDismiss],
  );

  const config = tier ? TIER_CONFIG[tier] : null;

  const sparks = useMemo(
    () => Array.from({ length: 18 }, (_, i) => sparkStyle(i)),
    [],
  );

  if (!tier || !config) return null;

  return (
    <div className="titan-jackpot-celebration" onClick={handleBackdrop} role="dialog" aria-label={`${config.label} won`}>
      {/* Radial light burst */}
      <div className="celebration-burst" aria-hidden>
        <div className="celebration-burst-ring" />
        <div className="celebration-burst-ring" />
        <div className="celebration-burst-ring" />
      </div>

      {/* Floating sparks */}
      <div className="celebration-sparks" aria-hidden>
        {sparks.map((style, i) => (
          <span key={i} className="celebration-spark" style={style} />
        ))}
      </div>

      {/* Content */}
      <div className="celebration-content">
        <span className={`celebration-tier-badge ${config.cssTier}`}>
          {config.label}
        </span>
        <span className={`celebration-prize ${config.cssTier}`}>
          ${prizeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="celebration-sub">
          {tier === "GRAND"
            ? "The wrath of Olympus is yours — MAXIMUM JACKPOT!"
            : `${config.multiplier}× base bet · Divine favor bestowed`}
        </span>
        <button className="celebration-dismiss" onClick={onDismiss} type="button">
          CLAIM REWARD
        </button>
      </div>
    </div>
  );
}
