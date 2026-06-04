import type { HeartbeatFrame, JackpotTier, WsFrame, WsFrame5 } from "./protocol";

export function connectFrame(
  agentId: string,
  accessToken: string,
  reconnect: boolean,
): WsFrame5 {
  return [
    1,
    "MiniGame",
    "",
    "",
    {
      agentId,
      accessToken,
      reconnect,
    },
  ];
}

export function joinFrame(gameRoute: string): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1005" }];
}

export function spinFrame(gameRoute: string, bet: string): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1500", bet }];
}

export function cheatFrame(gameRoute: string, reels: string[][]): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "2001", reels }];
}

export function forceJackpotNextSpinFrame(
  gameRoute: string,
  tier: JackpotTier,
): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "2002", tier }];
}

export function heartbeatFrame(counter: number): HeartbeatFrame {
  return ["7", "MiniGame", "1", counter];
}

/** Default page size for cmd 1502 (guide §8.1). */
export const HISTORY_LIST_DEFAULT_SIZE = 6;

/** cmd 1502 — Level 1: paginated list of finished spins. */
export function historyListFrame(
  gameRoute: string,
  /** 1-based page index (guide §8.1). */
  page: number,
  size: number = HISTORY_LIST_DEFAULT_SIZE,
): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1502", page, size }];
}

/** cmd 1510 — active jackpot pool amounts per tier. */
export function jackpotPoolsFrame(gameRoute: string): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1510" }];
}

/** cmd 1511 — recent jackpot wins (limit 1–100). */
export function jackpotWinHistoryFrame(
  gameRoute: string,
  limit: number,
): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1511", limit }];
}

/** cmd 1530 — GET_BALANCE (client query; reply on session topic). */
export function getBalanceFrame(gameRoute: string): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1530" }];
}

/** cmd 1503 — Level 2: detail for one spin in a finished round. */
export function historyDetailFrame(
  gameRoute: string,
  roundId: string,
  spinIndex: number,
): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1503", roundId, spinIndex }];
}
