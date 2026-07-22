import type { SpinResponsePayload } from "../../../ws/protocol";

export type TitanCelebrationKind = "jackpot" | "titan_wrath" | "combo" | "super_combo" | "mega_combo" | "respin" | "win";

export type TitanCelebrationItem = { id: string; kind: TitanCelebrationKind; title: string; detail?: string };

const KIND_PRIORITY: Record<TitanCelebrationKind, number> = {
  jackpot: 0, titan_wrath: 1, mega_combo: 2, super_combo: 3, combo: 4, respin: 5, win: 6,
};

export function buildTitanCelebrations(
  payload: SpinResponsePayload | null | undefined,
  comboLevel: "none" | "combo" | "super" | "mega",
): TitanCelebrationItem[] {
  if (!payload?.spin) return [];
  const items: TitanCelebrationItem[] = [];
  const spin = payload.spin;

  const jp = spin.jackpot as Record<string, unknown> | undefined;
  if (jp?.triggered && typeof jp.jackpotWin === "string") {
    items.push({ id: "jackpot", kind: "jackpot", title: "Jackpot!", detail: `${jp.tier ?? "—"} · +${jp.jackpotWin}` });
  }

  if (Array.isArray(spin.triggers) && spin.triggers.includes("TITANS_WRATH")) {
    items.push({ id: "titan_wrath", kind: "titan_wrath", title: "Titan's Wrath x4!", detail: "5-of-a-kind collision" });
  }

  if (comboLevel === "mega") items.push({ id: "mega", kind: "mega_combo", title: "MEGA COMBO!", detail: "6+ winning lines" });
  else if (comboLevel === "super") items.push({ id: "super", kind: "super_combo", title: "SUPER COMBO!", detail: "4-5 winning lines" });
  else if (comboLevel === "combo") items.push({ id: "combo", kind: "combo", title: "COMBO!", detail: "2-3 winning lines" });

  if (Array.isArray(spin.triggers) && spin.triggers.includes("RESPIN")) {
    items.push({ id: "respin", kind: "respin", title: "Respin!", detail: "Expanding Wild" });
  }

  return items.sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]).slice(0, 3);
}
