import { type JoinResponsePayload } from "../ws/protocol";

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
