import type { WsOutboundFrame } from "../../ws/protocol";

export const BULLET_GAME_ROUTE = "yama_01026";

/** cmd 1500 — SpinCommand.from requires numeric `betAmount` (not `bet`). */
export function bulletSpinFrame(betAmount: number): WsOutboundFrame {
  return [6, "MiniGame", BULLET_GAME_ROUTE, { cmd: 1500, betAmount }];
}

/** cmd 1507 — SELECT_FREE_SPIN_MODE: pick the pending free spins variant (GDD 6.2). */
export function bulletSelectFreeSpinModeFrame(mode: string): WsOutboundFrame {
  return [6, "MiniGame", BULLET_GAME_ROUTE, { cmd: 1507, mode }];
}
