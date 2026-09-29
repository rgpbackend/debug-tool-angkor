/**
 * Angkor-specific spin parsers.
 * Moved out of shared lib/session-utils.ts to keep game flows isolated.
 */
import {
  readDecimalWire,
  formatCreditAmount,
} from "../../../lib/session-utils";
import { parseJackpotGoldenWildPositions } from "../../../ws/protocol";
import type { SpinResponsePayload } from "./protocol";

// Re-export shared utilities used by Angkor components
export { readDecimalWire, formatCreditAmount };

export function readSpinJackpot(spin: SpinResponsePayload["spin"]): {
  triggered: boolean;
  tier: string | null;
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
    keys.add(`${p[0]}:${p[1]}`);
  }
  return keys;
}
