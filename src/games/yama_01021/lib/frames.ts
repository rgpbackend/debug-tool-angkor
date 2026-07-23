/**
 * Titan-specific WS frame builders.
 * Moved out of shared ws/frames.ts to keep game flows isolated.
 */
import type { WsOutboundFrame } from "../../../ws/protocol";

export function titanSpinFrame(
  gameRoute: string,
  betAmount: string,
): WsOutboundFrame {
  return [6, "MiniGame", gameRoute, { cmd: "1500", betAmount }];
}
