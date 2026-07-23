import type { WsOutboundFrame } from "./protocol";

export function connectFrame(
  agentId: string,
  accessToken: string,
  reconnect: boolean,
): WsOutboundFrame {
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

export function joinFrame(gameRoute: string): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1005" }];
}

export function heartbeatFrame(counter: number): WsOutboundFrame {
  return ["7", "MiniGame", "1", counter];
}

/** cmd 1510 — active jackpot pool amounts per tier. */
export function jackpotPoolsFrame(gameRoute: string): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1510" }];
}

/** cmd 1530 — GET_BALANCE (client query; reply on session topic). */
export function getBalanceFrame(gameRoute: string): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1530" }];
}
