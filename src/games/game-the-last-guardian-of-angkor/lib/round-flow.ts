import type { SpinResponsePayload } from "../../../ws/protocol";

/** Round still has pending feature steps (another cmd 1500 required). */
export function isRoundUnfinished(payload: SpinResponsePayload): boolean {
  return payload.round.isFinished === false;
}

/** UI-oriented phase derived from wire payload (not `round.state`). */
export type RoundDisplayPhase = "base" | "feature" | "ended";

export function readRoundDisplayPhase(
  payload: SpinResponsePayload,
): RoundDisplayPhase {
  if (payload.round.isFinished) {
    return "ended";
  }
  const spinType = payload.spin.spinType;
  if (spinType === "BASE") {
    return "base";
  }
  return "feature";
}
