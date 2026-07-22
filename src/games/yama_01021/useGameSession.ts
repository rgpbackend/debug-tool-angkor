import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWsSession, type WsSessionCallbacks } from "../../ws/useWsSession";
import { isSpinResponsePayload, isSpinErrorPayload } from "../../ws/browser-ws-client";
import { spinFrame } from "../../ws/frames";
import { readTopLevelBalance, type JackpotTierInfo, type SpinResponsePayload } from "../../ws/protocol";
import { evaluateAllPaylines, type ComboLevel } from "./lib/paylines";

export function useGameSession(
  wsUrl: string, gameId: string, agentId: string,
  jackpotTierInfo: JackpotTierInfo[],
  wsAccessToken: string, callbacks: WsSessionCallbacks,
) {
  const ws = useWsSession(wsUrl, gameId, agentId, jackpotTierInfo, wsAccessToken, callbacks);

  // Use server-provided bet levels; fall back to first level once session is ready.
  const [bet, setBet] = useState("0.10");

  // Set default bet from server levels once available.
  useEffect(() => {
    if (ws.betLevels.length > 0 && !ws.betLevels.includes(bet)) {
      setBet(ws.betLevels[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.betLevels]);

  const [superBet, setSuperBet] = useState(false);
  const [fastSpin, setFastSpin] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState<number | null>(null);
  const [lastSpin, setLastSpin] = useState<SpinResponsePayload | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const spinBusyRef = useRef(false);

  const totalBet = useMemo(() => {
    const base = Number(bet);
    if (!Number.isFinite(base)) return bet;
    return superBet ? (base * 1.5).toFixed(2) : bet;
  }, [bet, superBet]);

  const canSpin = ws.phase === "joined" && ws.sessionReady && ws.betLevels.length > 0;

  const spin = useCallback(async (): Promise<SpinResponsePayload | null> => {
    const client = ws.clientRef.current;
    if (!client?.isConnected() || ws.phase !== "joined" || !ws.sessionReady || spinBusyRef.current) return null;
    setGameError(null);
    spinBusyRef.current = true;
    try {
      const payloadPromise = client.waitForPayload(isSpinResponsePayload, "spin", { rejectMatcher: isSpinErrorPayload });
      client.sendFrame(spinFrame(ws.gameRoute, totalBet));
      const payload = await payloadPromise;
      const sp = payload as unknown as SpinResponsePayload;
      const bal = readTopLevelBalance(payload);
      if (bal) ws.setBalance(bal);
      setLastSpin(sp);
      return sp;
    } catch (e) {
      setGameError(e instanceof Error ? e.message : String(e));
      return null;
    } finally { spinBusyRef.current = false; }
  }, [totalBet, ws]);

  const comboResult = useMemo(() => {
    if (!lastSpin?.spin?.reels || ws.serverPaylines.length === 0) {
      return { matches: [], comboLevel: "none" as ComboLevel };
    }
    return evaluateAllPaylines(lastSpin.spin.reels, ws.serverPaylines);
  }, [lastSpin, ws.serverPaylines]);

  const isSpinning = ws.phase === "spinning";

  return {
    ...ws,
    error: gameError || ws.error,
    bet, setBet, betLevels: ws.betLevels,
    totalBet, superBet, setSuperBet,
    fastSpin, setFastSpin,
    autoSpinCount, setAutoSpinCount,
    lastSpin, spin, canSpin,
    comboResult,
    isSpinning,
  };
}

export type TitanGameSession = ReturnType<typeof useGameSession>;
