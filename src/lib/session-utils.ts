import {
  parseJackpotGoldenWildPositions,
  type JoinResponsePayload,
  type SpinResponsePayload,
} from "../ws/protocol";

/** Monetary wire value per §1.1 — decimal string (4 dp) or legacy JSON number. */
export function readDecimalWire(value: unknown, fallback = "0.0000"): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(4);
  }
  return fallback;
}

export function formatCreditAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return amount;
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function readBalanceString(
  payload: Record<string, unknown>,
): string | null {
  const balance = payload.balance;
  if (typeof balance === "string" && balance.trim()) {
    return balance.trim();
  }
  if (typeof balance === "number" && Number.isFinite(balance)) {
    return String(balance);
  }
  return null;
}

/** Wallet balance after a spin (cmd 1500) — `spin.balanceAfter` only. */
export function readSpinBalanceAfter(
  spin: Record<string, unknown>,
): string | null {
  const after = spin.balanceAfter;
  if (typeof after === "string" && after.trim()) {
    return after.trim();
  }
  if (typeof after === "number" && Number.isFinite(after)) {
    return after.toFixed(4);
  }
  return null;
}

export function readRoundBetString(round: { bet: unknown }): string | null {
  if (typeof round.bet === "string") {
    return round.bet;
  }
  if (typeof round.bet === "number" && Number.isFinite(round.bet)) {
    return round.bet.toFixed(4);
  }
  return null;
}

export function resolveBetFromLevels(
  levels: readonly string[],
  preferred?: string,
): string {
  if (levels.length === 0) {
    return preferred ?? "1";
  }
  if (preferred && levels.includes(preferred)) {
    return preferred;
  }
  if (preferred) {
    const prefNum = Number(preferred);
    if (Number.isFinite(prefNum)) {
      const match = levels.find((level) => Number(level) === prefNum);
      if (match) {
        return match;
      }
    }
  }
  return levels[0];
}

export function parseBetLevelsFromJoin(
  joinPayload: JoinResponsePayload,
): string[] {
  if (Array.isArray(joinPayload.betLevels)) {
    return joinPayload.betLevels.filter(
      (level): level is string => typeof level === "string",
    );
  }
  const raw = joinPayload as unknown as Record<string, unknown>;
  if (!Array.isArray(raw.betLevels)) {
    return [];
  }
  return raw.betLevels.filter(
    (level): level is string => typeof level === "string",
  );
}

function winWayHighlightKey(reelIndex: number, rowIndex: number): string {
  return `${reelIndex}:${rowIndex}`;
}

export function buildGoldenWildHighlightSet(
  pairs: readonly [number, number][] | undefined,
): Set<string> {
  const keys = new Set<string>();
  if (!pairs?.length) {
    return keys;
  }
  for (const p of pairs) {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      typeof p[0] !== "number" ||
      typeof p[1] !== "number"
    ) {
      continue;
    }
    keys.add(winWayHighlightKey(p[0], p[1]));
  }
  return keys;
}

export function readSpinJackpot(spin: SpinResponsePayload["spin"]): {
  triggered: boolean;
  tier: string | null;
  /** Credited jackpot amount (decimal string from wire). */
  jackpotWin: string;
  goldenWildPositions: [number, number][];
} {
  const j = spin.jackpot as Record<string, unknown> | undefined;
  if (!j || typeof j !== "object") {
    return {
      triggered: false,
      tier: null,
      jackpotWin: "0.0000",
      goldenWildPositions: [],
    };
  }
  const goldenWildPositions = parseJackpotGoldenWildPositions(
    j.goldenWildPositions,
  );
  return {
    triggered: Boolean(j.triggered),
    tier: typeof j.tier === "string" ? j.tier : null,
    jackpotWin: readDecimalWire(j.jackpotWin),
    goldenWildPositions,
  };
}

/** Scatters to collect during free-spin mode (retrigger meter). */
export const FREE_SPIN_SCATTER_TARGET = 5;

export type RoundFeatureBadges = {
  respin: { visible: boolean; remaining: number };
  freeSpin: {
    visible: boolean;
    remaining: number;
    scatterCollected: number;
    scatterTarget: number;
  };
};

/** Free-spin / respin counts from spin or join `state` (§1500). */
export function readRoundFeatureBadges(
  payload: { state?: SpinResponsePayload["state"] } | null | undefined,
): RoundFeatureBadges {
  const none: RoundFeatureBadges = {
    respin: { visible: false, remaining: 0 },
    freeSpin: {
      visible: false,
      remaining: 0,
      scatterCollected: 0,
      scatterTarget: FREE_SPIN_SCATTER_TARGET,
    },
  };
  if (!payload?.state || typeof payload.state !== "object") {
    return none;
  }

  const { freeSpin, respin } = payload.state;

  const freeRemaining =
    typeof freeSpin?.spinsLeft === "number" ? freeSpin.spinsLeft : 0;
  const freeVisible = Boolean(freeSpin?.active) || freeRemaining > 0;
  const scatterCollected =
    typeof freeSpin?.scatterCollected === "number"
      ? Math.max(0, freeSpin.scatterCollected)
      : 0;

  const respinSpinsLeft =
    typeof respin?.spinsLeft === "number" ? respin.spinsLeft : null;
  const respinCurrent =
    typeof respin?.currentStep === "number" ? respin.currentStep : 0;
  const respinTotal =
    typeof respin?.totalSteps === "number" ? respin.totalSteps : 0;
  const respinRemaining =
    respinSpinsLeft !== null
      ? Math.max(0, respinSpinsLeft)
      : Math.max(0, respinTotal - respinCurrent);
  const respinVisible = Boolean(respin?.active) || respinRemaining > 0;

  return {
    respin: { visible: respinVisible, remaining: respinRemaining },
    freeSpin: {
      visible: freeVisible,
      remaining: freeRemaining,
      scatterCollected: Math.min(scatterCollected, FREE_SPIN_SCATTER_TARGET),
      scatterTarget: FREE_SPIN_SCATTER_TARGET,
    },
  };
}

export function readSpinRetrigger(spin: SpinResponsePayload["spin"]): {
  triggered: boolean;
  scatterCount: number;
  addedFreeSpins: number;
  scatterPositions: [number, number][];
} {
  const retrigger = spin.retrigger as Record<string, unknown> | undefined;
  if (!retrigger || typeof retrigger !== "object") {
    return {
      triggered: false,
      scatterCount: 0,
      addedFreeSpins: 0,
      scatterPositions: [],
    };
  }
  const positionsRaw = retrigger.scatterPositions;
  const scatterPositions: [number, number][] = [];
  if (Array.isArray(positionsRaw)) {
    for (const item of positionsRaw) {
      if (
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "number" &&
        typeof item[1] === "number"
      ) {
        scatterPositions.push([item[0], item[1]]);
      }
    }
  }
  return {
    triggered: Boolean(retrigger.triggered),
    scatterCount:
      typeof retrigger.scatterCount === "number" ? retrigger.scatterCount : 0,
    addedFreeSpins:
      typeof retrigger.addedFreeSpins === "number"
        ? retrigger.addedFreeSpins
        : 0,
    scatterPositions,
  };
}
