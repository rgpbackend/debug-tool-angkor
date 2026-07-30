import { useCallback, useState, type RefObject } from "react";
import type { BrowserWsClient } from "../../../ws/browser-ws-client";

const COLS = 5;
const ROWS = 3;
const VALID_SYMBOLS = new Set(["A", "B", "C", "D", "E", "F", "G", "W"]);

interface DebugCheatPanelProps {
  clientRef: RefObject<BrowserWsClient | null>;
  canCheat: boolean;
  lastPatternGrid: string;
}

function emptyGrid(): string[][] {
  return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => ""));
}

function gridFromPattern(patternGrid: string): string[][] {
  if (patternGrid.length < COLS * ROWS) return emptyGrid();
  const grid: string[][] = [];
  for (let c = 0; c < COLS; c++) {
    const col: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      col.push(patternGrid[r * COLS + c] ?? "");
    }
    grid.push(col);
  }
  return grid;
}

export default function DebugCheatPanel({ clientRef, canCheat, lastPatternGrid }: DebugCheatPanelProps) {
  const [cheatGrid, setCheatGrid] = useState<string[][]>(emptyGrid);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);

  const setCell = useCallback((ci: number, ri: number, value: string) => {
    const v = value.slice(-1).toUpperCase();
    setCheatGrid((prev) => {
      const next = prev.map((col) => [...col]);
      if (next[ci]) next[ci][ri] = v;
      return next;
    });
    setStatus(null);
  }, []);

  const fillFromLast = useCallback(() => {
    if (!lastPatternGrid) return;
    setCheatGrid(gridFromPattern(lastPatternGrid));
    setStatus(null);
  }, [lastPatternGrid]);

  const clearAll = useCallback(() => {
    setCheatGrid(emptyGrid());
    setStatus(null);
  }, []);

  const sendCheat = useCallback(() => {
    const client = clientRef.current;
    if (!client?.isConnected()) return;

    // Validate all cells filled
    const reels: string[][] = [];
    for (let ci = 0; ci < COLS; ci++) {
      const col: string[] = [];
      for (let ri = 0; ri < ROWS; ri++) {
        const sym = cheatGrid[ci]?.[ri] ?? "";
        if (!sym || !VALID_SYMBOLS.has(sym)) {
          setStatus({ text: `Invalid symbol at reel ${ci + 1}, row ${ri + 1}`, ok: false });
          return;
        }
        col.push(sym);
      }
      reels.push(col);
    }

    try {
      client.sendFrame([6, "MiniGame", "yama_01021", { cmd: 2001, reels }]);
      setStatus({ text: "Cheat sent", ok: true });
    } catch (e) {
      setStatus({ text: e instanceof Error ? e.message : "Send failed", ok: false });
    }
  }, [cheatGrid, clientRef]);

  return (
    <div className="debug-cheat-panel">
      <div className="debug-cheat-grid">
        {Array.from({ length: COLS }, (_, ci) => (
          <div key={ci} className="debug-cheat-col">
            {Array.from({ length: ROWS }, (_, ri) => (
              <input
                key={ri}
                className="debug-cheat-cell"
                value={cheatGrid[ci]?.[ri] ?? ""}
                onChange={(e) => setCell(ci, ri, e.target.value)}
                maxLength={1}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                disabled={!canCheat}
                aria-label={`Reel ${ci + 1} row ${ri + 1}`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="debug-cheat-actions">
        <button className="debug-cheat-btn" onClick={fillFromLast} disabled={!canCheat || !lastPatternGrid}>
          Fill last
        </button>
        <button className="debug-cheat-btn" onClick={clearAll} disabled={!canCheat}>
          Clear
        </button>
        <button className="debug-cheat-btn primary" onClick={sendCheat} disabled={!canCheat}>
          Set Cheat
        </button>
      </div>

      <div className={`debug-cheat-status${status ? (status.ok ? " success" : " error") : ""}`}>
        {status?.text ?? " "}
      </div>
    </div>
  );
}
