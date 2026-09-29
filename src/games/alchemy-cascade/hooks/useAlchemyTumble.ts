import { useCallback, useRef, useState } from "react";
import { useSyncRef } from "../../../hooks/useSyncRef";
import type { AlchemySpinPayload } from "../alchemy-protocol";
import { emptyAlchemyGrid, emptyGoldenGrid } from "../alchemy-protocol";
import {
  convertingWildKeys,
  dropGrid,
  introGrid,
  pushTicker,
  removingGrid,
  tickerFromWins,
  toIdleGrid,
  blockStampKeys,
  changedSymbolKeys,
  paintBlocks,
  purgeInGrid,
  purgeOutGrid,
  stampRevealGrid,
  transmuteFromGrid,
  transmuteToGrid,
  winningGrid,
  type AlchemyDisplayCell,
  type AlchemyTickerEntry,
  type SymbolBlock,
} from "../lib/tumble";

export type AlchemyTumblePhase =
  | "idle"
  | "intro"
  | "win"
  | "remove"
  | "drop"
  | "settle"
  | "transmute"
  | "purge"
  | "crystallize"
  | "summon"
  | "splash"
  | "done";

export type AlchemyTumbleState = {
  isPlaying: boolean;
  phase: AlchemyTumblePhase;
  displayGrid: AlchemyDisplayCell[][];
  ticker: AlchemyTickerEntry[];
  stepWin: string;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const INITIAL: AlchemyTumbleState = {
  isPlaying: false,
  phase: "idle",
  displayGrid: toIdleGrid(emptyAlchemyGrid(), emptyAlchemyGrid(), emptyGoldenGrid()),
  ticker: [],
  stepWin: "0",
};

export function useAlchemyTumble(fastSpin: boolean) {
  const [state, setState] = useState<AlchemyTumbleState>(INITIAL);
  const cancelRef = useRef(false);
  const blocksRef = useRef<SymbolBlock[]>([]);
  const fastRef = useRef(fastSpin);
  useSyncRef(fastRef, fastSpin);

  const tw = (ms: number) => Math.max(20, Math.round(ms * (fastRef.current ? 0.2 : 1)));

  const showBlocks = (display: AlchemyDisplayCell[][], source: string[][]) => {
    blocksRef.current = blocksRef.current.filter((block) =>
      block.keys.every((key) => {
        const [c, r] = key.split(",").map(Number);
        return source[c]?.[r] === block.symbol;
      }),
    );
    return paintBlocks(display, blocksRef.current);
  };

  const rememberBlock = (keys: string[], source: string[][]) => {
    const size = Math.round(Math.sqrt(keys.length));
    if (size < 2 || size * size !== keys.length) return;
    const [c, r] = keys[0].split(",").map(Number);
    const symbol = source[c]?.[r] ?? "";
    if (!symbol) return;
    const covered = new Set(keys);
    blocksRef.current = [
      ...blocksRef.current.filter((block) => !block.keys.some((key) => covered.has(key))),
      { keys, size, symbol },
    ];
  };

  const showIdle = useCallback((payload: AlchemySpinPayload) => {
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      phase: "idle",
      displayGrid: showBlocks(
        toIdleGrid(payload.grid, payload.marks, payload.golden),
        payload.grid,
      ),
      stepWin: "0",
    }));
  }, []);

  const clearTicker = useCallback(() => {
    setState((prev) => ({ ...prev, ticker: [] }));
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setState((prev) => ({ ...prev, isPlaying: false, phase: "idle" }));
  }, []);

  const playIntro = useCallback(async (payload: AlchemySpinPayload) => {
    cancelRef.current = false;
    blocksRef.current = [];
    setState({
      isPlaying: true,
      phase: "intro",
      displayGrid: introGrid(payload.grid, payload.marks, payload.golden),
      ticker: [],
      stepWin: "0",
    });
    await wait(tw(400));
    if (cancelRef.current) return;
    setState((prev) => ({
      ...prev,
      phase: "idle",
      displayGrid: toIdleGrid(payload.grid, payload.marks, payload.golden),
    }));
  }, []);

  const playEval = useCallback(
    async (evalStep: AlchemySpinPayload, after: AlchemySpinPayload | null) => {
      if (cancelRef.current) return;

      const playTransmuteReveal = async () => {
        if (
          !after ||
          after.spinType !== "TRANSMUTE" ||
          evalStep.spinType === "TRANSMUTE"
        ) {
          return;
        }
        if (convertingWildKeys(evalStep.grid, after.grid).size === 0) {
          return;
        }
        setState((prev) => ({
          ...prev,
          isPlaying: true,
          phase: "transmute",
          displayGrid: showBlocks(
            transmuteFromGrid(evalStep.grid, evalStep.marks, evalStep.golden, after.grid),
            evalStep.grid,
          ),
        }));
        await wait(tw(900));
        if (cancelRef.current) return;
        setState((prev) => ({
          ...prev,
          phase: "transmute",
          displayGrid: showBlocks(
            transmuteToGrid(evalStep.grid, after.grid, after.marks, after.golden),
            after.grid,
          ),
        }));
        await wait(tw(1400));
      };

      const playPurgeReveal = async () => {
        if (!after || after.spinType !== "PURGE" || evalStep.spinType === "PURGE") {
          return;
        }
        setState((prev) => ({
          ...prev,
          isPlaying: true,
          phase: "purge",
          displayGrid: showBlocks(
            purgeOutGrid(evalStep.grid, evalStep.marks, evalStep.golden),
            evalStep.grid,
          ),
        }));
        await wait(tw(1000));
        if (cancelRef.current) return;
        blocksRef.current = [];
        setState((prev) => ({
          ...prev,
          phase: "purge",
          displayGrid: purgeInGrid(after.grid, after.marks, after.golden),
        }));
        await wait(tw(1100));
      };

      // GDD §4.4: a Crystallize square and a Summon block each land as one gem.
      // Potion Splash still pops wilds in one at a time.
      const playStampReveal = async (
        spinType: string,
        phase: "crystallize" | "summon" | "splash",
        stepMs: number,
        animMs: number,
        fallRows: number,
        sizes: number[] | null,
      ) => {
        if (!after || after.spinType !== spinType || evalStep.spinType === spinType) {
          return;
        }
        const keys = sizes
          ? blockStampKeys(evalStep.grid, after.grid, sizes)
          : changedSymbolKeys(evalStep.grid, after.grid);
        if (keys.length === 0) return;
        if (sizes) rememberBlock(keys, after.grid);
        setState((prev) => ({
          ...prev,
          isPlaying: true,
          phase,
          displayGrid: showBlocks(
            stampRevealGrid(after.grid, after.marks, after.golden, keys, phase, stepMs, fallRows),
            after.grid,
          ),
        }));
        await wait(tw((keys.length - 1) * stepMs + animMs));
      };

      if (evalStep.wins.length === 0) {
        setState((prev) => ({
          ...prev,
          phase: after ? "settle" : "done",
          displayGrid: showBlocks(
            toIdleGrid(evalStep.grid, evalStep.marks, evalStep.golden),
            evalStep.grid,
          ),
          stepWin: "0",
        }));
        await playTransmuteReveal();
        await playPurgeReveal();
        await playStampReveal("CRYSTALLIZE", "crystallize", 0, 1600, 2, [2]);
        await playStampReveal("SUMMON", "summon", 0, 2400, 5, [3, 4, 5]);
        await playStampReveal("POTION_SPLASH", "splash", 420, 900, 1, null);
        return;
      }

      const incoming = tickerFromWins(evalStep.wins, evalStep.roundId, evalStep.spinIndex);
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        phase: "win",
        displayGrid: showBlocks(
          winningGrid(evalStep.grid, evalStep.marks, evalStep.golden, evalStep.wins),
          evalStep.grid,
        ),
        ticker: pushTicker(prev.ticker, incoming),
        stepWin: evalStep.winAmount,
      }));
      await wait(tw(700));
      if (cancelRef.current) return;

      setState((prev) => ({
        ...prev,
        phase: "remove",
        displayGrid: showBlocks(
          removingGrid(evalStep.grid, evalStep.marks, evalStep.golden, evalStep.wins),
          evalStep.grid,
        ),
      }));
      await wait(tw(400));
      if (cancelRef.current) return;

      if (after) {
        setState((prev) => ({
          ...prev,
          phase: "drop",
          displayGrid: showBlocks(
            dropGrid(evalStep.grid, after.grid, after.marks, after.golden, evalStep.wins),
            after.grid,
          ),
        }));
        await wait(tw(800));
        if (cancelRef.current) return;

        setState((prev) => ({
          ...prev,
          phase: "settle",
          displayGrid: showBlocks(
            toIdleGrid(after.grid, after.marks, after.golden),
            after.grid,
          ),
        }));
        await wait(tw(600));
      } else {
        setState((prev) => ({
          ...prev,
          phase: "settle",
          displayGrid: showBlocks(
            toIdleGrid(evalStep.grid, evalStep.marks, evalStep.golden),
            evalStep.grid,
          ),
        }));
        await wait(tw(600));
      }
    },
    [],
  );

  const finish = useCallback((payload: AlchemySpinPayload | null) => {
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      phase: "done",
      displayGrid: payload
        ? showBlocks(toIdleGrid(payload.grid, payload.marks, payload.golden), payload.grid)
        : prev.displayGrid,
    }));
  }, []);

  return { ...state, playIntro, playEval, showIdle, clearTicker, cancel, finish };
}

export type AlchemyTumble = ReturnType<typeof useAlchemyTumble>;
