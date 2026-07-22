import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWsSession, type WsSessionCallbacks } from "../../ws/useWsSession";
import {
  hasCmd, decodePatternGrid, readTopLevelBalance,
  type JackpotTierInfo, type TitanSpinResponsePayload, type TitanPaylineWin,
} from "../../ws/protocol";
import { spinFrame } from "../../ws/frames";
import type { PaylineMatch } from "./lib/paylines";

function isTitanSpinPayload(payload: Record<string, unknown>): boolean {
  if (!hasCmd(payload, "1500") || payload.c !== 0) return false;
  const spin = payload.spin;
  if (typeof spin !== "object" || spin === null || Array.isArray(spin)) return false;
  return typeof (spin as Record<string, unknown>).patternGrid === "string";
}

function isTitanSpinError(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1500") && (payload.c === 1 || payload.errorCode != null);
}

/** Convert server payline wins to UI match format. */
function paylineWinsToMatches(
  wins: TitanPaylineWin[],
  serverPaylines: { rows: number[] }[],
): PaylineMatch[] {
  return wins.map((w) => {
    const plIndex = parseInt(w.paylineId.replace("P", ""), 10) - 1;
    const rows = serverPaylines[plIndex]?.rows ?? [];
    const positions: [number, number][] = rows.map((row, reel) => [reel, row] as [number, number]);
    return {
      paylineIndex: plIndex,
      symbol: w.symbol,
      count: w.count,
      positions,
      direction: w.direction === "RTL" ? "rtl" : "ltr",
    };
  });
}

export function useGameSession(
  wsUrl: string, gameId: string, agentId: string,
  jackpotTierInfo: JackpotTierInfo[],
  wsAccessToken: string, callbacks: WsSessionCallbacks,
) {
  const ws = useWsSession(wsUrl, gameId, agentId, jackpotTierInfo, wsAccessToken, callbacks);

  const [bet, setBet] = useState("0.10");
  useEffect(() => {
    if (ws.betLevels.length > 0 && !ws.betLevels.includes(bet)) setBet(ws.betLevels[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.betLevels]);

  const [superBet, setSuperBet] = useState(false);
  const [fastSpin, setFastSpin] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState<number | null>(null);
  const [lastSpin, setLastSpin] = useState<TitanSpinResponsePayload | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const spinBusyRef = useRef(false);

  const totalBet = useMemo(() => {
    const base = Number(bet);
    return Number.isFinite(base) ? (superBet ? (base * 1.5).toFixed(2) : bet) : bet;
  }, [bet, superBet]);

  const canSpin = ws.phase === "joined" && ws.sessionReady && ws.betLevels.length > 0;

  const spin = useCallback(async (): Promise<TitanSpinResponsePayload | null> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady || spinBusyRef.current) return null;
    setGameError(null);
    spinBusyRef.current = true;
    try {
      const pp = client.waitForPayload(isTitanSpinPayload, "spin", { rejectMatcher: isTitanSpinError });
      client.sendFrame(spinFrame(ws.gameRoute, totalBet));
      const raw = await pp;
      const sp = raw as unknown as TitanSpinResponsePayload;
      if (sp.c !== 0) throw new Error(`Spin rejected (c=${sp.c})`);
      const bal = readTopLevelBalance(raw);
      if (bal) ws.setBalance(bal);
      setLastSpin(sp);
      return sp;
    } catch (e) {
      setGameError(e instanceof Error ? e.message : String(e));
      return null;
    } finally { spinBusyRef.current = false; }
  }, [totalBet, ws]);

  // Decode grid from patternGrid
  const reelGrid = useMemo(() => {
    if (!lastSpin?.spin?.patternGrid) return Array.from({ length: 5 }, () => ["?", "?", "?"]);
    return decodePatternGrid(lastSpin.spin.patternGrid);
  }, [lastSpin]);

  // Build matches from server paylineWins
  const paylineMatches = useMemo(() => {
    const wins = lastSpin?.spin?.paylineWins;
    if (!wins || wins.length === 0) return [];
    return paylineWinsToMatches(wins, ws.serverPaylines);
  }, [lastSpin, ws.serverPaylines]);

  // Auto-spin next step when respin is active
  const hasPendingRespin = lastSpin?.state?.respin?.active === true;
  useEffect(() => {
    if (!hasPendingRespin || !canSpin || spinBusyRef.current) return;
    const t = window.setTimeout(() => { void spin(); }, fastSpin ? 100 : 800);
    return () => window.clearTimeout(t);
  }, [hasPendingRespin, canSpin, fastSpin, spin]);

  const isSpinning = ws.phase === "spinning" || hasPendingRespin;

  return {
    ...ws,
    error: gameError || ws.error,
    bet, setBet, betLevels: ws.betLevels,
    totalBet, superBet, setSuperBet,
    fastSpin, setFastSpin,
    autoSpinCount, setAutoSpinCount,
    lastSpin, spin, canSpin,
    reelGrid, paylineMatches, isSpinning,
  };
}

export type TitanGameSession = ReturnType<typeof useGameSession>;
