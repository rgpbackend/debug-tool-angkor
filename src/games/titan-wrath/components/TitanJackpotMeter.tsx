import { useEffect, useMemo, useRef, useState } from "react";
import type { JackpotTierEntry } from "../../../ws/protocol";
import type { TitanPoolBalanceChanged } from "../titan-protocol";

const TIER_CSS: Record<string, string> = {
  MINI: "tier-mini",
  MINOR: "tier-minor",
  MAJOR: "tier-major",
  GRAND: "tier-grand",
};

const TIER_LABEL: Record<string, string> = {
  MINI: "Mini",
  MINOR: "Minor",
  MAJOR: "Major",
  GRAND: "Grand",
};

interface TitanJackpotMeterProps {
  tokenCount: number;
  impactNew?: number;
  reachedTier: string | null;
  tierConfig: JackpotTierEntry[];
  poolBalances: TitanPoolBalanceChanged | null;
  baseBet: number;
}

function formatPrize(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getPoolPrize(tier: string, poolBalances: TitanPoolBalanceChanged | null): number {
  if (!poolBalances) return 0;
  if (tier === "GRAND") return Number(poolBalances.grand) || 0;
  if (tier === "MAJOR") return Number(poolBalances.major) || 0;
  return 0;
}

function getTierPrize(
  tier: string,
  entry: JackpotTierEntry | undefined,
  poolBalances: TitanPoolBalanceChanged | null,
  baseBet: number,
): number {
  // MINI / MINOR are fixed multiplier prizes
  if (entry?.multiplier && entry.multiplier > 0) {
    return entry.multiplier * baseBet;
  }
  // MAJOR / GRAND are progressive pool balances
  return getPoolPrize(tier, poolBalances);
}

export default function TitanJackpotMeter({
  tokenCount,
  impactNew = 0,
  reachedTier,
  tierConfig,
  poolBalances,
  baseBet,
}: TitanJackpotMeterProps) {
  const [flash, setFlash] = useState(false);
  const [impact, setImpact] = useState(false);
  const prevCount = useRef(tokenCount);

  const maxTokens = useMemo(
    () => tierConfig.reduce((max, t) => Math.max(max, t.requiredTokens), 0),
    [tierConfig],
  );

  // Flash on increment
  useEffect(() => {
    if (tokenCount > prevCount.current) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 500);
      prevCount.current = tokenCount;
      return () => window.clearTimeout(t);
    }
    prevCount.current = tokenCount;
  }, [tokenCount]);

  // Impact burst
  useEffect(() => {
    if (impactNew > 0) {
      setImpact(true);
      const t = window.setTimeout(() => setImpact(false), 600);
      return () => window.clearTimeout(t);
    }
  }, [impactNew]);

  const fillPct = maxTokens > 0 ? Math.min(100, (tokenCount / maxTokens) * 100) : 0;

  const tiers = useMemo(
    () =>
      tierConfig.map((t) => {
        const reached = tokenCount >= t.requiredTokens || reachedTier === t.tier;
        const prize = getTierPrize(t.tier, t, poolBalances, baseBet);
        const markerPct = maxTokens > 0 ? (t.requiredTokens / maxTokens) * 100 : 0;
        const isProgressive = !t.multiplier || t.multiplier === 0;
        return {
          tier: t.tier,
          label: TIER_LABEL[t.tier] ?? t.tier,
          tokens: t.requiredTokens,
          cssClass: TIER_CSS[t.tier] ?? "",
          reached,
          prize,
          markerPct,
          isProgressive,
        };
      }),
    [tierConfig, tokenCount, reachedTier, poolBalances, baseBet, maxTokens],
  );

  return (
    <div className="titan-jackpot-bar" aria-label={`Olympus Jackpot: ${tokenCount} of ${maxTokens} tokens`}>
      {/* Tier cards row */}
      <div className="jackpot-bar-cards">
        {tiers.map((t) => (
          <div
            key={t.tier}
            className={`jackpot-bar-card ${t.cssClass}${t.reached ? " card-reached" : ""}`}
          >
            <span className="card-tier-name">{t.label}</span>
            <span className={`card-tier-prize${t.isProgressive ? " prize-progressive" : ""}`}>
              {t.isProgressive && poolBalances === null
                ? "…"
                : formatPrize(t.prize)}
            </span>
          </div>
        ))}
      </div>

      {/* Progress track */}
      <div className={`jackpot-bar-track${impact ? " track-impact" : ""}`}>
        <div
          className={`jackpot-bar-fill${flash ? " fill-flash" : ""}`}
          style={{ width: `${fillPct}%` }}
        />

        {/* Token count badge on the fill */}
        {tokenCount > 0 && (
          <span className="jackpot-bar-badge" style={{ left: `calc(${fillPct}% - 16px)` }}>
            {tokenCount}
          </span>
        )}

        {/* Tier markers */}
        {tiers.map((t) => (
          <div
            key={t.tier}
            className={`jackpot-bar-marker${t.reached ? " marker-reached" : ""}`}
            style={{ left: `${t.markerPct}%` }}
          >
            <div className="marker-dot" />
          </div>
        ))}

        {/* Impact sparks */}
        {impact && (
          <div className="bar-impact-sparks" aria-hidden>
            {Array.from({ length: impactNew }, (_, i) => (
              <span
                key={i}
                className="bar-impact-spark"
                style={{ left: `calc(${fillPct}% - 4px)`, animationDelay: `${i * 0.06}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
