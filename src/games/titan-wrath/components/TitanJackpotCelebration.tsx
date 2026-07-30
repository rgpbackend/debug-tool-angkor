import { useCallback, useEffect, useMemo } from "react";
import type { JackpotTierEntry } from "../../../ws/protocol";

type JackpotTier = "MINI" | "MINOR" | "MAJOR" | "GRAND";

interface TitanJackpotCelebrationProps {
  tier: JackpotTier | null;
  prizeAmount: number;
  tokenCount: number;
  tierConfig: JackpotTierEntry[];
  onDismiss: () => void;
}

const TIER_LABELS: Record<string, string> = {
  MINI: "Mini Jackpot",
  MINOR: "Minor Jackpot",
  MAJOR: "Major Jackpot",
  GRAND: "Grand Jackpot",
};

const TIER_CSS: Record<string, string> = {
  MINI: "tier-mini",
  MINOR: "tier-minor",
  MAJOR: "tier-major",
  GRAND: "tier-grand",
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
  tierConfig,
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

  const config = useMemo(() => {
    if (!tier) return null;
    const entry = tierConfig.find((t) => t.tier === tier);
    return {
      label: TIER_LABELS[tier] ?? `${tier} Jackpot`,
      multiplier: entry?.multiplier ?? 0,
      cssTier: TIER_CSS[tier] ?? "",
    };
  }, [tier, tierConfig]);

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
