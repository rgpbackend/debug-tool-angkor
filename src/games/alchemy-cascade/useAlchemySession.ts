import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWsSession, type WsSessionCallbacks } from "../../ws/useWsSession";
import { resolveBetFromLevels } from "../../lib/session-utils";
import { parseAlchemyMessage } from "./alchemy-message-parser";
import { alchemySpinFrame, alchemyStepFrame, ALCHEMY_GAME_ROUTE } from "./alchemy-frames";
import {
  ALCHEMY_STEP_CAP,
  formatAlchemyError,
  isAlchemyBalanceUpdate,
  isAlchemySessionTakenOver,
  isAlchemySpinError,
  isAlchemySpinResponse,
  parseAlchemyFromLastRound,
  parseAlchemySpinPayload,
  type AlchemySpinPayload,
} from "./alchemy-protocol";

const WS_CONNECTION_LOST_RE =
  /timeout|WS closed|WS connect error|not connected|Disconnected before|Disconnected after/i;

function isWsConnectionLost(msg: string): boolean {
  return WS_CONNECTION_LOST_RE.test(msg);
}

const ALCHEMY_AGENT_ID = "AGENCY_001";
/** GDD §7. The stake stays the cluster stake; the wallet debit is this multiple. */
const BUY_FEATURE_MULTIPLIER = 100;

export type AlchemySpinPlayback = {
  onBase: (step: AlchemySpinPayload) => Promise<void>;
  onEval: (evalStep: AlchemySpinPayload, after: AlchemySpinPayload | null) => Promise<void>;
};

export function useAlchemySession(
  wsUrl: string,
  wsAccessToken: string,
  callbacks: WsSessionCallbacks,
  initialBalance?: string | null,
) {
  const wrappedCallbacks: WsSessionCallbacks = {
    onTokenBan: () => {
      callbacks.onTokenBan();
    },
    onConnectionLost: (msg: string) => {
      callbacks.onConnectionLost(msg);
    },
  };

  const ws = useWsSession(
    wsUrl,
    ALCHEMY_GAME_ROUTE,
    ALCHEMY_AGENT_ID,
    [],
    wsAccessToken,
    wrappedCallbacks,
    parseAlchemyMessage,
  );

  const [bet, setBet] = useState<string>("");
  const [lastSpin, setLastSpin] = useState<AlchemySpinPayload | null>(null);
  const [steps, setSteps] = useState<AlchemySpinPayload[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const spinBusyRef = useRef(false);

  const error = gameError || ws.error;
  const setBalance = ws.setBalance;

  useEffect(() => {
    if (ws.sessionReady && initialBalance) {
      setBalance(initialBalance);
    }
  }, [ws.sessionReady, initialBalance, setBalance]);

  const betLevels = ws.betLevels;

  const selectBetValue = useMemo(
    () => resolveBetFromLevels(betLevels, bet),
    [betLevels, bet],
  );

  useEffect(() => {
    if (!ws.sessionReady || lastSpin) return;
    const restored = parseAlchemyFromLastRound(
      ws.lastRound as Record<string, unknown> | null,
    );
    if (!restored) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed from 1005 lastRound
    setLastSpin(restored);
    setSteps([restored]);
    setViewIndex(0);
  }, [ws.sessionReady, ws.lastRound, lastSpin]);

  const canSpin = ws.phase === "joined" && ws.sessionReady && !isSpinning;

  const publish = (collected: AlchemySpinPayload[], last: AlchemySpinPayload) => {
    setSteps([...collected]);
    setLastSpin(last);
    setViewIndex(collected.length - 1);
  };

  const spin = useCallback(
    async (
      playback?: AlchemySpinPlayback,
      buyFeature = false,
    ): Promise<AlchemySpinPayload | null> => {
      const client = ws.clientRef.current;
      if (
        !client?.isConnected() ||
        ws.phase !== "joined" ||
        !ws.sessionReady ||
        spinBusyRef.current
      ) {
        return null;
      }
      const betNum = Number(selectBetValue);
      if (!Number.isFinite(betNum) || !ws.betLevels.length) return null;
      setGameError(null);
      spinBusyRef.current = true;

      const curBal = Number(ws.balance);
      const debit = buyFeature ? betNum * BUY_FEATURE_MULTIPLIER : betNum;
      if (Number.isFinite(curBal)) {
        ws.setBalance(String(Math.max(0, curBal - debit)));
      }

      setIsSpinning(true);
      const collected: AlchemySpinPayload[] = [];
      try {
        const waitSpin = () =>
          client.waitForPayload(isAlchemySpinResponse, "alchemy spin", {
            rejectMatcher: isAlchemySpinError,
          });

        client.sendFrame(alchemySpinFrame(betNum, buyFeature));
        let parsed = parseAlchemySpinPayload(await waitSpin());
        collected.push(parsed);
        publish(collected, parsed);
        await playback?.onBase(parsed);

        if (parsed.nextAction === "CASCADE" && parsed.roundId) {
          client.sendFrame(alchemyStepFrame(parsed.roundId, parsed.spinIndex + 1));
          parsed = parseAlchemySpinPayload(await waitSpin());
          collected.push(parsed);
          publish(collected, parsed);

          while (collected.length <= ALCHEMY_STEP_CAP) {
            let after: AlchemySpinPayload | null = null;
            if (
              parsed.nextAction === "CASCADE" &&
              parsed.roundId &&
              collected.length < ALCHEMY_STEP_CAP
            ) {
              client.sendFrame(alchemyStepFrame(parsed.roundId, parsed.spinIndex + 1));
              after = parseAlchemySpinPayload(await waitSpin());
              collected.push(after);
              publish(collected, after);
            }
            await playback?.onEval(parsed, after);
            if (!after) break;
            parsed = after;
          }
        }

        if (parsed.balance) {
          ws.setBalance(parsed.balance);
        }
        setIsSpinning(false);
        spinBusyRef.current = false;
        return parsed;
      } catch (e) {
        setIsSpinning(false);
        spinBusyRef.current = false;
        if (collected.length > 0) {
          publish(collected, collected[collected.length - 1]);
        }
        const msg = e instanceof Error ? e.message : String(e);
        if (!client.isConnected() || isWsConnectionLost(msg)) {
          callbacks.onConnectionLost(msg);
        } else {
          setGameError(msg);
        }
        return null;
      }
    },
    [selectBetValue, ws, callbacks],
  );

  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client || !ws.sessionReady) return;
    return client.addPayloadListener(isAlchemyBalanceUpdate, (payload) => {
      const bal = payload.balance;
      if (typeof bal === "string") setBalance(bal);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clientRef
  }, [ws.sessionReady, setBalance]);

  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client) return;
    return client.addPayloadListener(isAlchemySpinError, (payload) => {
      const c = typeof payload.c === "number" ? payload.c : 0;
      const mgs =
        typeof payload.msg === "string"
          ? payload.msg
          : typeof payload.mgs === "string"
            ? payload.mgs
            : undefined;
      setGameError(formatAlchemyError(c, mgs));
      setIsSpinning(false);
      spinBusyRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clientRef
  }, []);

  useEffect(() => {
    const client = ws.clientRef.current;
    if (!client) return;
    return client.addPayloadListener(isAlchemySessionTakenOver, () => {
      setSessionTakenOver(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clientRef
  }, [ws.phase]);

  const dismissSessionTakenOver = useCallback(() => {
    setSessionTakenOver(false);
    callbacks.onConnectionLost("Session taken over");
  }, [callbacks]);

  return {
    phase: ws.phase,
    sessionReady: ws.sessionReady,
    gameScreenActive: ws.gameScreenActive,
    joinGame: ws.joinGame,
    joinRetryOpen: ws.joinRetryOpen,
    joinRetryMessage: ws.joinRetryMessage,
    joinRetryBusy: ws.joinRetryBusy,
    retryJoinGame: ws.retryJoinGame,
    dismissJoinRetry: ws.dismissJoinRetry,
    error,
    setGameError,
    balance: ws.balance,
    betLevels,
    symbolCatalog: ws.symbolCatalog,
    bet: selectBetValue,
    setBet,
    spin,
    canSpin,
    isSpinning,
    lastSpin,
    steps,
    viewIndex,
    setViewIndex,
    sessionTakenOver,
    dismissSessionTakenOver,
    clientRef: ws.clientRef,
  };
}

export type AlchemySession = ReturnType<typeof useAlchemySession>;
