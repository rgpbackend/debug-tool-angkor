import { useEffect, useRef, useState } from "react";

/** Token thresholds for each jackpot tier. */
export const JACKPOT_TIER_THRESHOLDS: { tier: string; tokens: number; cssClass: string }[] = [
  { tier: "MINI",  tokens: 3, cssClass: "tier-label-mini" },
  { tier: "MINOR", tokens: 4, cssClass: "tier-label-minor" },
  { tier: "MAJOR", tokens: 5, cssClass: "tier-label-major" },
  { tier: "GRAND", tokens: 6, cssClass: "tier-label-grand" },
];

const MAX_TOKENS = 6;

interface TitanJackpotMeterProps {
  /** Current token count to display. */
  tokenCount: number;
  /** Number of new tokens arriving right now (for impact animation). */
  impactNew?: number;
  /** Highest tier reached so far (if any). */
  reachedTier: string | null;
}

export default function TitanJackpotMeter({ tokenCount, impactNew = 0, reachedTier }: TitanJackpotMeterProps) {
  const [flash, setFlash] = useState(false);
  const [impact, setImpact] = useState(false);
  const prevCount = useRef(tokenCount);

  // Flash when tokenCount changes (meter just updated)
  useEffect(() => {
    if (tokenCount > prevCount.current) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 500);
      prevCount.current = tokenCount;
      return () => window.clearTimeout(t);
    }
    prevCount.current = tokenCount;
  }, [tokenCount]);

  // Impact burst when new tokens arrive
  useEffect(() => {
    if (impactNew > 0) {
      setImpact(true);
      const t = window.setTimeout(() => setImpact(false), 600);
      return () => window.clearTimeout(t);
    }
  }, [impactNew]);

  const fillPct = Math.min(100, (tokenCount / MAX_TOKENS) * 100);

  return (
    <div className="titan-jackpot-meter" aria-label={`Jackpot meter: ${tokenCount} of ${MAX_TOKENS} tokens`}>
      {/* Label row */}
      <div className="jackpot-meter-label">
        <span className="jackpot-meter-label-rule" />
        <span className="jackpot-meter-label-text">Olympus Jackpot</span>
        <span className="jackpot-meter-label-rule" />
      </div>

      {/* Track with fill + tier markers */}
      <div className={`jackpot-meter-track${impact ? " meter-impact" : ""}`}>
        <div
          className={`jackpot-meter-fill${flash ? " flash" : ""}`}
          style={{ transform: `scaleX(${fillPct / 100})` }}
        />

        {/* Impact burst particles at the fill edge */}
        {impact && (
          <div className="meter-impact-burst" aria-hidden>
            {Array.from({ length: impactNew }, (_, i) => (
              <span key={i} className="meter-impact-spark" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        )}

        <div className="jackpot-meter-tiers">
          {JACKPOT_TIER_THRESHOLDS.map((t) => {
            const reached = tokenCount >= t.tokens;
            return (
              <div
                key={t.tier}
                className={`jackpot-meter-tier-marker${reached ? " tier-reached" : ""}`}
              >
                <div className="jackpot-meter-tier-dots">
                  {Array.from({ length: t.tokens }, (_, i) => (
                    <span
                      key={i}
                      className={`jackpot-meter-tier-dot${i < tokenCount ? " dot-filled" : ""}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tier labels below */}
      <div className="jackpot-meter-tier-labels">
        {JACKPOT_TIER_THRESHOLDS.map((t) => {
          const reached = tokenCount >= t.tokens || reachedTier === t.tier;
          return (
            <span
              key={t.tier}
              className={`jackpot-meter-tier-label ${t.cssClass}${reached ? " tier-reached" : ""}`}
            >
              {t.tier}
            </span>
          );
        })}
      </div>
    </div>
  );
}
