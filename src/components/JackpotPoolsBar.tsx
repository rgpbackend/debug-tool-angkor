import { useMemo } from "react";
import {
  formatStaticJackpotPoolAmount,
  isStaticJackpotTier,
  type JackpotPool,
  type JackpotPoolsByTier,
  type JackpotTier,
  type JackpotTierInfo,
} from "../ws/protocol";

export interface JackpotPoolsBarProps {
  poolsByTier: JackpotPoolsByTier;
  betAmount: string;
  connected: boolean;
  loading: boolean;
  canCheat?: boolean;
  forceJackpotBusy?: boolean;
  onForceJackpot?: (tier: JackpotTier) => void | Promise<void>;
  /** Per-game tier metadata. */
  jackpotTiers: readonly JackpotTierInfo[];
  /** Compact strip below reel grid (single row). */
  embedded?: boolean;
}

function tierLabel(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

function PoolCard({
  pool,
  tier,
  betAmount,
  jackpotTiers,
  canCheat = false,
  forceJackpotBusy = false,
  onForceJackpot,
}: Readonly<{
  pool: JackpotPool | null;
  tier: JackpotTier;
  betAmount: string;
  jackpotTiers: readonly JackpotTierInfo[];
  canCheat?: boolean;
  forceJackpotBusy?: boolean;
  onForceJackpot?: (tier: JackpotTier) => void | Promise<void>;
}>) {
  const isStatic = isStaticJackpotTier(jackpotTiers, tier);
  const staticAmount = formatStaticJackpotPoolAmount(
    jackpotTiers,
    betAmount,
    tier,
  );
  const displayAmount = isStatic
    ? (staticAmount ?? "—")
    : (pool?.currentAmount ?? "—");
  const showCheatButton = Boolean(onForceJackpot);

  const handleForceJackpot = () => {
    if (!canCheat || forceJackpotBusy || !onForceJackpot) {
      return;
    }
    void onForceJackpot(tier);
  };

  return (
    <div
      className={`jackpot-pool-card jackpot-pool-${tier.toLowerCase()}${isStatic ? " jackpot-pool-static" : " jackpot-pool-progressive"}`}
    >
      <div className="jackpot-pool-card-top">
        <span className="jackpot-pool-tier">{tierLabel(tier)}</span>
        {showCheatButton ? (
          <button
            type="button"
            className="jackpot-pool-cheat-btn"
            onClick={handleForceJackpot}
            disabled={!canCheat || forceJackpotBusy}
            title={`Force ${tierLabel(tier)} jackpot on next base spin (2002)`}
            aria-label={`Cheat ${tierLabel(tier)} jackpot`}
          >
            <span className="jackpot-pool-cheat-btn-icon" aria-hidden>
              ⚡
            </span>
          </button>
        ) : null}
      </div>
      <span className="jackpot-pool-amount">{displayAmount}</span>
    </div>
  );
}

function PoolGroup({
  tiers,
  poolsByTier,
  betAmount,
  jackpotTiers,
  canCheat,
  forceJackpotBusy,
  onForceJackpot,
}: Readonly<{
  tiers: readonly JackpotTier[];
  poolsByTier: JackpotPoolsByTier;
  betAmount: string;
  jackpotTiers: readonly JackpotTierInfo[];
  canCheat?: boolean;
  forceJackpotBusy?: boolean;
  onForceJackpot?: (tier: JackpotTier) => void | Promise<void>;
}>) {
  return (
    <div className="jackpot-pools-group">
      <div className="jackpot-pools-group-grid">
        {tiers.map((tier) => (
          <PoolCard
            key={tier}
            tier={tier}
            pool={poolsByTier[tier]}
            betAmount={betAmount}
            jackpotTiers={jackpotTiers}
            canCheat={canCheat}
            forceJackpotBusy={forceJackpotBusy}
            onForceJackpot={onForceJackpot}
          />
        ))}
      </div>
    </div>
  );
}

function PoolStatus({
  connected,
  loading,
  hasAnyPool,
}: Readonly<{
  connected: boolean;
  loading: boolean;
  hasAnyPool: boolean;
}>) {
  if (loading) {
    return <span className="muted jackpot-pools-status">Updating…</span>;
  }
  if (!connected) {
    return (
      <span className="muted jackpot-pools-status">Connect to load pools</span>
    );
  }
  if (!hasAnyPool) {
    return (
      <span className="muted jackpot-pools-status">Awaiting pool data</span>
    );
  }
  return null;
}

export default function JackpotPoolsBar({
  poolsByTier,
  betAmount,
  connected,
  loading,
  canCheat = false,
  forceJackpotBusy = false,
  onForceJackpot,
  jackpotTiers,
  embedded = false,
}: Readonly<JackpotPoolsBarProps>) {
  const tierKeys = useMemo(
    () => jackpotTiers.map((t) => t.key),
    [jackpotTiers],
  );
  const staticTierKeys = useMemo(
    () => jackpotTiers.filter((t) => t.isStatic).map((t) => t.key),
    [jackpotTiers],
  );
  const progressiveTierKeys = useMemo(
    () => jackpotTiers.filter((t) => !t.isStatic).map((t) => t.key),
    [jackpotTiers],
  );
  const hasAnyPool = tierKeys.some((tier) => poolsByTier[tier] !== null);

  if (embedded) {
    return (
      <div
        className="jackpot-pools jackpot-pools--embedded"
        aria-label="Jackpot pools"
      >
        <PoolStatus
          connected={connected}
          loading={loading}
          hasAnyPool={hasAnyPool}
        />
        <div className="jackpot-pools-embedded-grid">
          {tierKeys.map((tier) => (
            <PoolCard
              key={tier}
              tier={tier}
              pool={poolsByTier[tier]}
              betAmount={betAmount}
              jackpotTiers={jackpotTiers}
              canCheat={canCheat}
              forceJackpotBusy={forceJackpotBusy}
              onForceJackpot={onForceJackpot}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="jackpot-pools slot-stage-surface"
      aria-label="Jackpot pools"
    >
      <div className="jackpot-pools-header">
        <h3 className="jackpot-pools-title">Jackpots</h3>
        <PoolStatus
          connected={connected}
          loading={loading}
          hasAnyPool={hasAnyPool}
        />
      </div>
      <div className="jackpot-pools-groups">
        {staticTierKeys.length > 0 ? (
          <PoolGroup
            tiers={staticTierKeys}
            poolsByTier={poolsByTier}
            betAmount={betAmount}
            jackpotTiers={jackpotTiers}
            canCheat={canCheat}
            forceJackpotBusy={forceJackpotBusy}
            onForceJackpot={onForceJackpot}
          />
        ) : null}
        {progressiveTierKeys.length > 0 ? (
          <PoolGroup
            tiers={progressiveTierKeys}
            poolsByTier={poolsByTier}
            betAmount={betAmount}
            jackpotTiers={jackpotTiers}
            canCheat={canCheat}
            forceJackpotBusy={forceJackpotBusy}
            onForceJackpot={onForceJackpot}
          />
        ) : null}
      </div>
    </div>
  );
}
