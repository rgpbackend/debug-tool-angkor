/**
 * Angkor-specific WS frame builders.
 * Moved out of shared ws/frames.ts to keep game flows isolated.
 */
import type { WsOutboundFrame, JackpotTier } from "../../../ws/protocol";

export function spinFrame(gameRoute: string, bet: string): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1500", bet }];
}

export function cheatFrame(
  gameRoute: string,
  reels: string[][],
): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "2001", reels }];
}

export function forceJackpotNextSpinFrame(
  gameRoute: string,
  tier: JackpotTier,
): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "2002", tier }];
}

export const HISTORY_LIST_DEFAULT_SIZE = 6;

export function historyListFrame(
  gameRoute: string,
  page: number,
  size: number = HISTORY_LIST_DEFAULT_SIZE,
): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1502", page, size }];
}

export function historyDetailFrame(
  gameRoute: string,
  roundId: string,
  spinIndex: number,
): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1503", roundId, spinIndex }];
}

export function jackpotWinHistoryFrame(
  gameRoute: string,
  limit: number,
): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1511", limit }];
}
