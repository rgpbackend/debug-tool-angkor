import {
  formatCreditAmount,
  readDecimalWire,
  readSpinJackpot,
  readSpinRetrigger,
} from "../../../lib/session-utils";
import type { SpinResponsePayload, WinWay } from "../../../ws/protocol";

export type CelebrationKind =
  | "jackpot"
  | "free_spin"
  | "retrigger"
  | "guardian_wild"
  | "respin"
  | "win";

export type CelebrationItem = {
  id: string;
  kind: CelebrationKind;
  title: string;
  detail?: string;
};

const KIND_PRIORITY: Record<CelebrationKind, number> = {
  jackpot: 0,
  free_spin: 1,
  retrigger: 2,
  guardian_wild: 3,
  respin: 4,
  win: 5,
};

function spinTriggers(spin: SpinResponsePayload["spin"]): string[] {
  return Array.isArray(spin.triggers)
    ? spin.triggers.filter((t): t is string => typeof t === "string")
    : [];
}

function guardianWildTriggered(spin: SpinResponsePayload["spin"]): boolean {
  return Boolean(spin.guardianWild?.triggered);
}

function sumWinWayPayouts(ways: WinWay[]): string | null {
  let total = 0;
  let any = false;
  for (const way of ways) {
    const n = Number(
      typeof way.payout === "string" ? way.payout : way.payout,
    );
    if (Number.isFinite(n)) {
      total += n;
      any = true;
    }
  }
  if (!any) {
    return null;
  }
  return formatCreditAmount(String(total));
}

/** Build overlay celebration toasts for the current settled spin view. */
export function buildSpinCelebrations(
  payload: SpinResponsePayload | null | undefined,
  winWays: WinWay[],
): CelebrationItem[] {
  if (!payload?.spin) {
    return [];
  }

  const spin = payload.spin;
  const items: CelebrationItem[] = [];
  const triggers = spinTriggers(spin);
  const jackpot = readSpinJackpot(spin);
  const retrigger = readSpinRetrigger(spin);

  if (jackpot.triggered) {
    items.push({
      id: "jackpot",
      kind: "jackpot",
      title: "Jackpot!",
      detail: `${jackpot.tier ?? "—"} · +${formatCreditAmount(jackpot.jackpotWin)}`,
    });
  }

  if (retrigger.triggered) {
    items.push({
      id: "retrigger",
      kind: "retrigger",
      title: "Retrigger!",
      detail: `+${retrigger.addedFreeSpins} free spin${retrigger.addedFreeSpins === 1 ? "" : "s"} · ${retrigger.scatterCount} scatter${retrigger.scatterCount === 1 ? "" : "s"}`,
    });
  } else if (triggers.includes("FREE_SPIN")) {
    items.push({
      id: "free_spin",
      kind: "free_spin",
      title: "Free Spins!",
      detail: "Feature activated",
    });
  }

  if (guardianWildTriggered(spin)) {
    items.push({
      id: "guardian_wild",
      kind: "guardian_wild",
      title: "Guardian Wild!",
      detail: "Wilds added to the grid",
    });
  }

  if (triggers.includes("RESPIN")) {
    const respinWin = readDecimalWire(spin.win as unknown);
    items.push({
      id: "respin",
      kind: "respin",
      title: "Respin!",
      detail:
        respinWin !== "0.0000"
          ? `+${formatCreditAmount(respinWin)}`
          : "Sticky wild expansion",
    });
  }

  const spinWin = readDecimalWire(spin.win as unknown);
  const hasLineWin =
    Number(spinWin) > 0 || winWays.length > 0;
  if (hasLineWin && !jackpot.triggered) {
    const payoutSum = sumWinWayPayouts(winWays);
    items.push({
      id: "win",
      kind: "win",
      title: winWays.length > 1 ? `${winWays.length} Win Ways!` : "Winner!",
      detail:
        payoutSum != null
          ? `+${payoutSum}`
          : spinWin !== "0.0000"
            ? `+${formatCreditAmount(spinWin)}`
            : undefined,
    });
  }

  return items
    .sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind])
    .slice(0, 2);
}
