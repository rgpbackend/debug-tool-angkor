import type { WsOutboundFrame } from "../../ws/protocol";

const TITAN_ROUTE = "yama_01021";

export function titanSpinFrame(
  betAmount: number,
  superBet: boolean,
): WsOutboundFrame {
  return [6, "MiniGame", TITAN_ROUTE, { cmd: 1500, betAmount, superBet }];
}
