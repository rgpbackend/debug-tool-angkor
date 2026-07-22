import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWsSession, type WsSessionCallbacks } from "../../ws/useWsSession";
import { hasCmd, readTopLevelBalance, type JackpotTierInfo, type TitanSpinResponsePayload } from "../../ws/protocol";
import { spinFrame } from "../../ws/frames";
import { evaluateAllPaylines, type ComboLevel } from "./lib/paylines";

/** Titan spin response: cmd 1500 with grid, roundState, isLastSpin. */
function isTitanSpinPayload(payload: Record<string, unknown>): boolean {
  if (!hasCmd(payload, "1500")) return false;
  const spin = payload.spin;
  if (typeof spin !== "object" || spin === null || Array.isArray(spin)) return false;
  const s = spin as Record<string, unknown>;
  return Array.isArray(s.grid);
}

function isTitanSpinError(payload: Record<string, unknown>): boolean {
  return hasCmd(payload, "1500") && (payload.c === 1 || payload.errorCode != null);
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
      const bal = readTopLevelBalance(raw);
      if (bal) ws.setBalance(bal);
      setLastSpin(sp);
      return sp;
    } catch (e) {
      setGameError(e instanceof Error ? e.message : String(e));
      return null;
    } finally { spinBusyRef.current = false; }
  }, [totalBet, ws]);

  // Combo from spin grid
  const comboResult = useMemo(() => {
    if (!lastSpin?.spin?.grid || ws.serverPaylines.length === 0) {
      return { matches: [], comboLevel: "none" as ComboLevel };
    }
    return evaluateAllPaylines(lastSpin.spin.grid, ws.serverPaylines);
  }, [lastSpin, ws.serverPaylines]);

  // Round ongoing → auto-spin next step (respin chain)
  const roundOngoing = lastSpin?.round?.roundState === "ONGOING";
  useEffect(() => {
    if (!roundOngoing || !canSpin) return;
    if (fastSpin) {
      void spin();
      return;
    }
    const t = window.setTimeout(() => { void spin(); }, 800);
    return () => window.clearTimeout(t);
  }, [roundOngoing, canSpin, fastSpin, spin]);

  const isSpinning = ws.phase === "spinning" || roundOngoing;

  return {
    ...ws,
    error: gameError || ws.error,
    bet, setBet, betLevels: ws.betLevels,
    totalBet, superBet, setSuperBet,
    fastSpin, setFastSpin,
    autoSpinCount, setAutoSpinCount,
    lastSpin, spin, canSpin,
    comboResult, isSpinning, roundOngoing,
  };
}

export type TitanGameSession = ReturnType<typeof useGameSession>;
