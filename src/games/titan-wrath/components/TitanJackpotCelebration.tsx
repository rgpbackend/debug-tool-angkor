import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Local visibility is decoupled from the parent's `tier` prop so that
 * React batching / StrictMode double-invocation cannot prematurely
 * dismiss the overlay before the user sees it.
 */
export default function TitanJackpotCelebration({
  tier,
  prizeAmount,
  tokenCount: _tokenCount,
  tierConfig,
  onDismiss,
}: TitanJackpotCelebrationProps) {
  const [visible, setVisible] = useState(false);

  // Snapshot the winning tier data when tier first becomes non-null.
  const snapshotRef = useRef<{
    tier: JackpotTier;
    prizeAmount: number;
    tokenCount: number;
  } | null>(null);

  // When the parent signals a new jackpot, capture it and start the timer.
  useEffect(() => {
    if (!tier) return;
    snapshotRef.current = {
      tier,
      prizeAmount,
      tokenCount: _tokenCount,
    };
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      // Notify parent AFTER the exit animation so it can reset lastJackpotWin.
      window.setTimeout(() => onDismiss(), 400);
    }, 1000);
    return () => window.clearTimeout(timer);
    // Only react when tier transitions null → non-null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  // Let parent know we're done once visibility transitions to hidden.
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    prevVisibleRef.current = visible;
  }, [visible]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setVisible(false);
        window.setTimeout(() => onDismiss(), 400);
      }
    },
    [onDismiss],
  );

  const activeTier = snapshotRef.current?.tier ?? null;
  const activePrize = snapshotRef.current?.prizeAmount ?? 0;

  const config = useMemo(() => {
    if (!activeTier) return null;
    const entry = tierConfig.find((t) => t.tier === activeTier);
    return {
      label: TIER_LABELS[activeTier] ?? `${activeTier} Jackpot`,
      multiplier: entry?.multiplier ?? 0,
      cssTier: TIER_CSS[activeTier] ?? "",
    };
  }, [activeTier, tierConfig]);

  const sparks = useMemo(
    () => Array.from({ length: 18 }, (_, i) => sparkStyle(i)),
    [],
  );

  if (!visible || !activeTier || !config) return null;

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
          ${activePrize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="celebration-sub">
          {config.multiplier
            ? `${config.multiplier}× base bet · Divine favor bestowed`
            : activeTier === "GRAND"
              ? "The wrath of Olympus is yours — MAXIMUM JACKPOT!"
              : "Progressive pool claimed · Olympus smiles upon you"}
        </span>
      </div>
    </div>
  );
}
