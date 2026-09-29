import {
  ALCHEMY_GRID_SIZE,
  type AlchemyClusterWin,
} from "../alchemy-protocol";

export type AlchemyCellState =
  | "idle"
  | "intro"
  | "winning"
  | "removing"
  | "new"
  | "transmute-from"
  | "transmute"
  | "purge-out"
  | "purge-in"
  | "crystallize"
  | "summon"
  | "splash";

export type AlchemyDisplayCell = {
  symbol: string;
  mark: string;
  /** GDD §5 golden spot. At most one cell on the board is true. */
  golden: boolean;
  state: AlchemyCellState;
  delay: number;
  fallRows: number;
  /** Top-left of a Crystallize or Summon square. One gem covers this many cells. */
  blockSize?: number;
  /** Other cells of that square; the gem on the anchor draws them. */
  blockMember?: boolean;
};

export type SymbolBlock = {
  keys: string[];
  size: number;
  symbol: string;
};

export type AlchemyTickerEntry = {
  id: string;
  symbol: string;
  count: number;
  winAmount: string;
};

function goldenAt(golden: boolean[][], column: number, row: number): boolean {
  return golden[column]?.[row] === true;
}

export function winKeySet(wins: AlchemyClusterWin[]): Set<string> {
  const keys = new Set<string>();
  for (const win of wins) {
    for (const cell of win.cells) {
      keys.add(`${cell.column},${cell.row}`);
    }
  }
  return keys;
}

export function toIdleGrid(
  grid: string[][],
  marks: string[][],
  golden: boolean[][],
): AlchemyDisplayCell[][] {
  return grid.map((col, c) =>
    col.map((symbol, r) => ({
      symbol,
      mark: marks[c]?.[r] ?? "",
      golden: goldenAt(golden, c, r),
      state: "idle" as const,
      delay: 0,
      fallRows: 0,
    })),
  );
}

export function introGrid(
  grid: string[][],
  marks: string[][],
  golden: boolean[][],
): AlchemyDisplayCell[][] {
  return grid.map((col, c) =>
    col.map((symbol, r) => ({
      symbol,
      mark: marks[c]?.[r] ?? "",
      golden: goldenAt(golden, c, r),
      state: "intro" as const,
      delay: (c + r) * 18,
      fallRows: 0,
    })),
  );
}

export function winningGrid(
  grid: string[][],
  marks: string[][],
  golden: boolean[][],
  wins: AlchemyClusterWin[],
): AlchemyDisplayCell[][] {
  const hits = winKeySet(wins);
  return grid.map((col, c) =>
    col.map((symbol, r) => ({
      symbol,
      mark: marks[c]?.[r] ?? "",
      golden: goldenAt(golden, c, r),
      state: hits.has(`${c},${r}`) ? ("winning" as const) : ("idle" as const),
      delay: 0,
      fallRows: 0,
    })),
  );
}

export function removingGrid(
  grid: string[][],
  marks: string[][],
  golden: boolean[][],
  wins: AlchemyClusterWin[],
): AlchemyDisplayCell[][] {
  const hits = winKeySet(wins);
  return grid.map((col, c) =>
    col.map((symbol, r) => ({
      symbol,
      mark: marks[c]?.[r] ?? "",
      golden: goldenAt(golden, c, r),
      state: hits.has(`${c},${r}`) ? ("removing" as const) : ("idle" as const),
      delay: 0,
      fallRows: 0,
    })),
  );
}

/**
 * Gravity matches ClusterBoard.tumble: survivors fall toward the bottom (higher row),
 * new symbols fill from the top. `from*` is the evaluated grid; `to*` is the post-tumble grid.
 */
export function dropGrid(
  fromGrid: string[][],
  toGrid: string[][],
  toMarks: string[][],
  toGolden: boolean[][],
  wins: AlchemyClusterWin[],
): AlchemyDisplayCell[][] {
  const removed = winKeySet(wins);
  return toGrid.map((col, c) => {
    const keptFromRows: number[] = [];
    for (let r = 0; r < ALCHEMY_GRID_SIZE; r++) {
      if (!removed.has(`${c},${r}`)) {
        keptFromRows.push(r);
      }
    }
    const missing = ALCHEMY_GRID_SIZE - keptFromRows.length;
    return col.map((symbol, r) => {
      const mark = toMarks[c]?.[r] ?? "";
      const golden = goldenAt(toGolden, c, r);
      if (r < missing) {
        return {
          symbol,
          mark,
          golden,
          state: "new" as const,
          delay: r * 40,
          fallRows: missing,
        };
      }
      const fromRow = keptFromRows[r - missing] ?? r;
      return {
        symbol: fromGrid[c]?.[fromRow] ?? symbol,
        mark,
        golden,
        state: "idle" as const,
        delay: 0,
        fallRows: r - fromRow,
      };
    });
  });
}

export function tickerFromWins(
  wins: AlchemyClusterWin[],
  roundId: string,
  spinIndex: number,
): AlchemyTickerEntry[] {
  return wins.map((win, i) => ({
    id: `${roundId}-${spinIndex}-${win.symbol}-${i}`,
    symbol: win.symbol,
    count: win.count,
    winAmount: win.winAmount,
  }));
}

export function pushTicker(
  current: AlchemyTickerEntry[],
  incoming: AlchemyTickerEntry[],
  cap = 3,
): AlchemyTickerEntry[] {
  return [...incoming, ...current].slice(0, cap);
}

/** Cells that became wild between a dead cascade board and the first Transmute eval. */
export function convertingWildKeys(fromGrid: string[][], toGrid: string[][]): Set<string> {
  const keys = new Set<string>();
  for (let c = 0; c < ALCHEMY_GRID_SIZE; c++) {
    for (let r = 0; r < ALCHEMY_GRID_SIZE; r++) {
      if (toGrid[c]?.[r] === "W" && fromGrid[c]?.[r] !== "W") {
        keys.add(`${c},${r}`);
      }
    }
  }
  return keys;
}

export function transmuteFromGrid(
  fromGrid: string[][],
  fromMarks: string[][],
  fromGolden: boolean[][],
  toGrid: string[][],
): AlchemyDisplayCell[][] {
  const converting = convertingWildKeys(fromGrid, toGrid);
  return fromGrid.map((col, c) =>
    col.map((symbol, r) => ({
      symbol,
      mark: fromMarks[c]?.[r] ?? "",
      golden: goldenAt(fromGolden, c, r),
      state: converting.has(`${c},${r}`) ? ("transmute-from" as const) : ("idle" as const),
      delay: converting.has(`${c},${r}`) ? (c + r) * 35 : 0,
      fallRows: 0,
    })),
  );
}

/** Full-grid wipe before the first PURGE eval: old cells shatter, then the new draw drops in. */
export function purgeOutGrid(
  grid: string[][],
  marks: string[][],
  golden: boolean[][],
): AlchemyDisplayCell[][] {
  return grid.map((col, c) =>
    col.map((symbol, r) => ({
      symbol,
      mark: marks[c]?.[r] ?? "",
      golden: goldenAt(golden, c, r),
      state: "purge-out" as const,
      delay: (c + r) * 18,
      fallRows: 0,
    })),
  );
}

export function purgeInGrid(
  grid: string[][],
  marks: string[][],
  golden: boolean[][],
): AlchemyDisplayCell[][] {
  return grid.map((col, c) =>
    col.map((symbol, r) => ({
      symbol,
      mark: marks[c]?.[r] ?? "",
      golden: goldenAt(golden, c, r),
      state: "purge-in" as const,
      delay: (c + r) * 18,
      fallRows: ALCHEMY_GRID_SIZE,
    })),
  );
}

/** Cells whose symbol changed between a dead board and the first modifier eval. Column-major. */
export function changedSymbolKeys(fromGrid: string[][], toGrid: string[][]): string[] {
  const keys: string[] = [];
  for (let c = 0; c < ALCHEMY_GRID_SIZE; c++) {
    for (let r = 0; r < ALCHEMY_GRID_SIZE; r++) {
      if ((toGrid[c]?.[r] ?? "") !== (fromGrid[c]?.[r] ?? "")) {
        keys.push(`${c},${r}`);
      }
    }
  }
  return keys;
}

/**
 * Full square that was stamped, including cells that already showed that symbol.
 * A diff-only set leaves a hole, so a 3×3 can look like eight falling cells.
 */
export function blockStampKeys(
  fromGrid: string[][],
  toGrid: string[][],
  sizes: number[],
): string[] {
  const changed = changedSymbolKeys(fromGrid, toGrid);
  if (changed.length === 0) return changed;
  const positions = changed.map((key) => key.split(",").map(Number) as [number, number]);
  const symbol = toGrid[positions[0][0]]?.[positions[0][1]] ?? "";
  if (positions.some(([c, r]) => (toGrid[c]?.[r] ?? "") !== symbol)) return changed;

  const minC = Math.min(...positions.map(([c]) => c));
  const minR = Math.min(...positions.map(([, r]) => r));
  for (const size of [...sizes].sort((a, b) => a - b)) {
    let bestKeys: string[] | null = null;
    let bestSlack = Number.POSITIVE_INFINITY;
    for (let col = 0; col <= ALCHEMY_GRID_SIZE - size; col++) {
      for (let row = 0; row <= ALCHEMY_GRID_SIZE - size; row++) {
        if (col > minC || row > minR) continue;
        if (
          !positions.every(
            ([c, r]) => c >= col && c < col + size && r >= row && r < row + size,
          )
        ) {
          continue;
        }
        const keys: string[] = [];
        let uniform = true;
        for (let c = col; c < col + size && uniform; c++) {
          for (let r = row; r < row + size; r++) {
            if ((toGrid[c]?.[r] ?? "") !== symbol) {
              uniform = false;
              break;
            }
            keys.push(`${c},${r}`);
          }
        }
        if (!uniform) continue;
        const slack = minC - col + (minR - row);
        if (bestKeys === null || slack < bestSlack) {
          bestKeys = keys;
          bestSlack = slack;
        }
      }
    }
    if (bestKeys) return bestKeys;
  }
  return changed;
}

/**
 * Marks a stamped square so the grid draws one gem on its top-left cell.
 * Cells that no longer hold the block's symbol are left as ordinary tiles.
 */
export function paintBlocks(
  grid: AlchemyDisplayCell[][],
  blocks: SymbolBlock[],
): AlchemyDisplayCell[][] {
  if (blocks.length === 0) return grid;
  const anchor = new Map<string, number>();
  const members = new Set<string>();
  for (const block of blocks) {
    const positions = block.keys.map((key) => key.split(",").map(Number) as [number, number]);
    const minC = Math.min(...positions.map(([c]) => c));
    const minR = Math.min(...positions.map(([, r]) => r));
    anchor.set(`${minC},${minR}`, block.size);
    for (const [c, r] of positions) {
      if (c !== minC || r !== minR) members.add(`${c},${r}`);
    }
  }
  return grid.map((col, c) =>
    col.map((cell, r) => {
      const size = anchor.get(`${c},${r}`);
      if (size) return { ...cell, blockSize: size, blockMember: false };
      if (members.has(`${c},${r}`)) {
        return { ...cell, blockSize: undefined, blockMember: true, state: "idle", delay: 0, fallRows: 0 };
      }
      return cell;
    }),
  );
}

/**
 * Destination grid with the newly stamped cells arriving in `keys` order.
 * Unstamped cells stay idle. Used for Crystallize, Summon, and Potion Splash.
 */
export function stampRevealGrid(
  toGrid: string[][],
  toMarks: string[][],
  toGolden: boolean[][],
  keys: string[],
  state: "crystallize" | "summon" | "splash",
  stepMs: number,
  fallRows: number,
): AlchemyDisplayCell[][] {
  const order = new Map(keys.map((key, index) => [key, index]));
  return toGrid.map((col, c) =>
    col.map((symbol, r) => {
      const index = order.get(`${c},${r}`);
      const arriving = index !== undefined;
      return {
        symbol,
        mark: arriving ? "" : (toMarks[c]?.[r] ?? ""),
        golden: goldenAt(toGolden, c, r),
        state: arriving ? state : ("idle" as const),
        delay: arriving ? index * stepMs : 0,
        fallRows: arriving ? fallRows : 0,
      };
    }),
  );
}

export function transmuteToGrid(
  fromGrid: string[][],
  toGrid: string[][],
  toMarks: string[][],
  toGolden: boolean[][],
): AlchemyDisplayCell[][] {
  const converting = convertingWildKeys(fromGrid, toGrid);
  return toGrid.map((col, c) =>
    col.map((symbol, r) => ({
      symbol,
      mark: toMarks[c]?.[r] ?? "",
      golden: goldenAt(toGolden, c, r),
      state: converting.has(`${c},${r}`) ? ("transmute" as const) : ("idle" as const),
      delay: converting.has(`${c},${r}`) ? (c + r) * 35 : 0,
      fallRows: 0,
    })),
  );
}
