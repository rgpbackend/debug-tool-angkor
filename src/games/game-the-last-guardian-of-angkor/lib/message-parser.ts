import { parseStompErrorCode } from "../../../ws/stomp-errors";
import type { ParseMessageFn } from "../../../ws/browser-ws-client";

/** Angkor inbound: STOMP frame arrays [type, ...strings, payload]
 *  or raw JSON objects (some responses come unwrapped). */
export const parseAngkorMessage: ParseMessageFn = async (raw) => {
  try {
    const text = typeof raw === "string" ? raw : await raw.text();
    const parsed: unknown = JSON.parse(text);
    const stompCode = parseStompErrorCode(parsed);
    if (stompCode !== null) return { type: "stomp-error", code: stompCode };

    // STOMP frame array: [type, ...strings, payload]
    if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === "number") {
      const payload = parsed.at(-1);
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return { type: "payload", payload: payload as Record<string, unknown> };
      }
    }
    // Raw JSON object (some responses come unwrapped)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { type: "payload", payload: parsed as Record<string, unknown> };
    }
    return null;
  } catch {
    return null;
  }
};
