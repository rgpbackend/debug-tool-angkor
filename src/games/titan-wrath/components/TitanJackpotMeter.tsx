import { useEffect, useMemo, useRef, useState } from "react";
import type { JackpotTierEntry } from "../../../ws/protocol";

const TIER_CSS: Record<string, string> = {
  MINI: "tier-label-mini",
  MINOR: "tier-label-minor",
  MAJOR: "tier-label-major",
  GRAND: "tier-label-grand",
};

interface TitanJackpotMeterProps {
  /** Current token count to display. */
  tokenCount: number;
  /** Number of new tokens arriving right now (for impact animation). */
  impactNew?: number;
  /** Highest tier reached so far (if any). */
  reachedTier: string | null;
  /** Tier definitions from server JOIN (sorted by requiredTokens asc). */
  tierConfig: JackpotTierEntry[];
  /** Current base bet for prize calculation (prize = multiplier × baseBet). */
  baseBet: number;
}

export default function TitanJackpotMeter({ tokenCount, impactNew = 0, reachedTier, tierConfig, baseBet }: TitanJackpotMeterProps) {
  const [flash, setFlash] = useState(false);
  const [impact, setImpact] = useState(false);
  const prevCount = useRef(tokenCount);

  // Derive max tokens from tier config (highest requiredTokens).
  const maxTokens = useMemo(
    () => tierConfig.reduce((max, t) => Math.max(max, t.requiredTokens), 0),
    [tierConfig],
  );

  // Build tier marker data from config.
  const tierMarkers = useMemo(
    () =>
      tierConfig.map((t) => ({
        tier: t.tier,
        tokens: t.requiredTokens,
        cssClass: TIER_CSS[t.tier] ?? "",
      })),
    [tierConfig],
  );

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

  const fillPct = maxTokens > 0 ? Math.min(100, (tokenCount / maxTokens) * 100) : 0;

  return (
    <div className="titan-jackpot-meter" aria-label={`Jackpot meter: ${tokenCount} of ${maxTokens} tokens`}>
      {/* Label row */}
      <div className="jackpot-meter-label">
        <span className="jackpot-meter-label-rule" />
        <span className="jackpot-meter-label-text">Olympus Jackpot</span>
        <span className="jackpot-meter-label-rule" />
      </div>

      {/* Vertical bar + labels side by side */}
      <div className="jackpot-meter-body">
        <div className={`jackpot-meter-track${impact ? " meter-impact" : ""}`}>
          <div
            className={`jackpot-meter-fill${flash ? " flash" : ""}`}
            style={{ height: `${fillPct}%` }}
          />

          {impact && (
            <div className="meter-impact-burst" aria-hidden>
              {Array.from({ length: impactNew }, (_, i) => (
                <span key={i} className="meter-impact-spark" style={{ animationDelay: `${i * 0.08}s` }} />
              ))}
            </div>
          )}

          <div className="jackpot-meter-tiers">
            {tierMarkers.map((t) => {
              const reached = tokenCount >= t.tokens;
              const pct = maxTokens > 0 ? (t.tokens / maxTokens) * 100 : 0;
              return (
                <div
                  key={t.tier}
                  className={`jackpot-meter-tier-marker${reached ? " tier-reached" : ""}`}
                  style={{ top: `${100 - pct}%` }}
                >
                  <div className="jackpot-meter-tier-dot" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="jackpot-meter-tier-labels">
          {tierMarkers.map((t) => {
            const reached = tokenCount >= t.tokens || reachedTier === t.tier;
            const entry = tierConfig.find((e) => e.tier === t.tier);
            const prize = entry ? entry.multiplier * baseBet : 0;
            const labelPct = maxTokens > 0 ? (t.tokens / maxTokens) * 100 : 0;
            return (
              <span
                key={t.tier}
                className={`jackpot-meter-tier-label ${t.cssClass}${reached ? " tier-reached" : ""}`}
                style={{ top: `${100 - labelPct}%` }}
              >
                <span className="tier-label-name">{t.tier}</span>
                <span className="tier-label-prize">
                  {prize < 1_000_000
                    ? `$${prize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${(prize / 1_000_000).toFixed(1)}M`}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
