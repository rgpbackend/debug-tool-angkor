import type { WsOutboundFrame } from "../../ws/protocol";

const TITAN_ROUTE = "yama_01021";

export function titanSpinFrame(
  betAmount: number,
  superBet: boolean,
): WsOutboundFrame {
  return [6, "MiniGame", TITAN_ROUTE, { cmd: 1500, betAmount, superBet }];
}

export function titanHistoryListFrame(): WsOutboundFrame {
  return [6, "MiniGame", TITAN_ROUTE, { cmd: 1503 }];
}

export function titanHistoryDetailFrame(
  roundId: string,
  spinIndex: number,
): WsOutboundFrame {
  return [6, "MiniGame", TITAN_ROUTE, { cmd: 1504, roundId, spinIndex }];
}

export function titanJackpotWinHistoryFrame(): WsOutboundFrame {
  return [6, "MiniGame", TITAN_ROUTE, { cmd: 1505 }];
}

export function titanDebugCheatGridFrame(grid: string): WsOutboundFrame {
  return [6, "MiniGame", TITAN_ROUTE, { cmd: 2001, grid }];
}

export function titanDebugCheatJackpotFrame(token: number): WsOutboundFrame {
  return [6, "MiniGame", TITAN_ROUTE, { cmd: 2002, token }];
}
