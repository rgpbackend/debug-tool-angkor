import type { WsOutboundFrame } from "../../ws/protocol";

export const ALCHEMY_GAME_ROUTE = "yama_01027";

/** cmd 1500 — first step of a paid spin. `betAmount` is the stake. `buyFeature` debits 100× that stake. */
export function alchemySpinFrame(betAmount: number, buyFeature = false): WsOutboundFrame {
  return [
    6,
    "MiniGame",
    ALCHEMY_GAME_ROUTE,
    buyFeature ? { cmd: 1500, betAmount, buyFeature: true } : { cmd: 1500, betAmount },
  ];
}

/** cmd 1500 — replay step `step` of an already-settled round (0-based). */
export function alchemyStepFrame(roundId: string, step: number): WsOutboundFrame {
  return [6, "MiniGame", ALCHEMY_GAME_ROUTE, { cmd: 1500, roundId, step }];
}
