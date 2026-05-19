import {
  CELEBRATION_SEQUENCE_MS,
  WIN_PRESENTATION_DWELL_MS,
} from "./celebration-timing";
import { buildSpinCelebrations } from "./spin-celebrations";
import type { SpinResponsePayload } from "../ws/protocol";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Wait until reel presentation has started and finished.
 * Avoids exiting early when `isSpinUiActive` is false for a frame before
 * `reelsPresenting` is set.
 */
export async function waitForReelPresentationComplete(
  isSpinUiActive: () => boolean,
  pollMs = 32,
  maxWaitMs = 12_000,
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;

  let sawActive = isSpinUiActive();
  while (!sawActive && Date.now() < deadline) {
    await delay(pollMs);
    sawActive = isSpinUiActive();
  }

  while (isSpinUiActive() && Date.now() < deadline) {
    await delay(pollMs);
  }
}

/** Wait for reel stop, win highlights, and celebration overlay for one spin step. */
export async function waitAfterSpinStep(
  payload: SpinResponsePayload,
  isSpinUiActive: () => boolean,
): Promise<void> {
  await waitForReelPresentationComplete(isSpinUiActive);
  await waitForPaint();

  const winWays = payload.spin.winWays ?? [];
  if (winWays.length > 0) {
    await delay(WIN_PRESENTATION_DWELL_MS);
  }

  const celebrations = buildSpinCelebrations(payload, winWays);
  if (celebrations.length > 0) {
    await delay(CELEBRATION_SEQUENCE_MS);
  }
}
