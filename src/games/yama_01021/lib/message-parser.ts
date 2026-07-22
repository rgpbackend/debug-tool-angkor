import { parseStompErrorCode } from "../../../ws/stomp-errors";
import type { ParseMessageFn } from "../../../ws/browser-ws-client";

/** Titan inbound: raw JSON objects. */
export const parseTitanMessage: ParseMessageFn = async (raw) => {
  try {
    const text = typeof raw === "string" ? raw : await raw.text();
    const parsed: unknown = JSON.parse(text);
    const stompCode = parseStompErrorCode(parsed);
    if (stompCode !== null) return { type: "stomp-error", code: stompCode };

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { type: "payload", payload: parsed as Record<string, unknown> };
    }
    return null;
  } catch {
    return null;
  }
};
