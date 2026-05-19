export const EXPECTED_CHEAT_REEL_SIZES = [3, 4, 4, 4, 3] as const;
export const VALID_CHEAT_SYMBOLS = new Set([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "GW",
  "H",
  "I",
  "W",
  "S",
]);

export const CHEAT_SYMBOL_OPTIONS = [...VALID_CHEAT_SYMBOLS].sort((a, b) =>
  a.localeCompare(b),
);

export function emptyCheatGrid(): string[][] {
  return EXPECTED_CHEAT_REEL_SIZES.map((len) =>
    Array.from({ length: len }, () => ""),
  );
}

export function normalizeCheatSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function isCheatCellOverridden(
  editValue: string,
  sourceValue: string,
): boolean {
  return normalizeCheatSymbol(editValue) !== normalizeCheatSymbol(sourceValue);
}

export function cheatGridsEqual(a: string[][], b: string[][]): boolean {
  return EXPECTED_CHEAT_REEL_SIZES.every((expectedLen, ci) => {
    for (let ri = 0; ri < expectedLen; ri += 1) {
      if ((a[ci]?.[ri] ?? "") !== (b[ci]?.[ri] ?? "")) {
        return false;
      }
    }
    return true;
  });
}

export function cloneCheatGrid(grid: string[][]): string[][] {
  return grid.map((col) => [...col]);
}

export function cheatGridFromSpinReels(reels: string[][]): string[][] {
  return EXPECTED_CHEAT_REEL_SIZES.map((expectedLen, ci) => {
    const col = reels[ci] ?? [];
    return Array.from({ length: expectedLen }, (_, ri) => {
      const raw = col[ri];
      if (typeof raw !== "string") {
        return "";
      }
      return raw.trim().toUpperCase();
    });
  });
}

/** True while typing or when value is a complete allowed symbol (empty allowed). */
export function isAllowedCheatSymbolInput(raw: string): boolean {
  const value = raw.trim().toUpperCase();
  if (!value) {
    return true;
  }
  if (VALID_CHEAT_SYMBOLS.has(value)) {
    return true;
  }
  return CHEAT_SYMBOL_OPTIONS.some((symbol) => symbol.startsWith(value));
}

function normalizeCheatSymbolInput(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (u === "GW" || u.endsWith("GW")) {
    return "GW";
  }
  return u.slice(-1);
}

export function setCheatCellValue(
  prev: string[][],
  ci: number,
  ri: number,
  colLen: number,
  raw: string,
): string[][] {
  const v = normalizeCheatSymbolInput(raw);
  const next = prev.map((c) => [...c]);
  if ((next[ci]?.length ?? 0) !== colLen) {
    next[ci] = Array.from({ length: colLen }, (_, i) => next[ci]?.[i] ?? "");
  }
  next[ci][ri] = v;
  return next;
}

export function validateCheatReels(reels: string[][]): {
  reels?: string[][];
  error?: string;
} {
  if (reels.length !== EXPECTED_CHEAT_REEL_SIZES.length) {
    return { error: "Cheat reels must contain exactly 5 columns." };
  }

  const normalized: string[][] = [];
  for (let ci = 0; ci < reels.length; ci += 1) {
    const expectedLen = EXPECTED_CHEAT_REEL_SIZES[ci];
    const col = reels[ci];
    if (col.length !== expectedLen) {
      return {
        error: `Reel ${ci + 1} must contain ${expectedLen} symbols.`,
      };
    }
    const symbols: string[] = [];
    for (let ri = 0; ri < col.length; ri += 1) {
      const raw = col[ri]?.trim() ?? "";
      if (!raw) {
        return {
          error: `Empty cell at reel ${ci + 1}, row ${ri + 1}.`,
        };
      }
      const symbol = raw.toUpperCase();
      if (!VALID_CHEAT_SYMBOLS.has(symbol)) {
        return {
          error: `Invalid symbol "${symbol}" at reel ${ci + 1}, row ${ri + 1}. Allowed: A-I, W, GW, S.`,
        };
      }
      symbols.push(symbol);
    }
    normalized.push(symbols);
  }
  return { reels: normalized };
}
