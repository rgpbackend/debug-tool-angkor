import type { HeartbeatFrame, WsFrame, WsFrame5 } from "./protocol";

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

export function forceJackpotNextSpinFrame(gameRoute: string): WsFrame {
  return [6, "MiniGame", gameRoute, { cmd: "2002" }];
}

export function heartbeatFrame(): HeartbeatFrame {
  return ["7", "MiniGame", "1", 2];
}
