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

export function heartbeatFrame(): HeartbeatFrame {
  return ["7", "MiniGame", "1", 2];
}

/** cmd 1502 — Level 1: paginated list of finished spins. */
export function historyListFrame(
  gameRoute: string,
  page: number,
  size: number,
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

/** cmd 1503 — Level 2: detail for one spin in a finished round. */
export function historyDetailFrame(
  gameRoute: string,
  roundId: string,
  spinIndex: number,
): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1503", roundId, spinIndex }];
}
