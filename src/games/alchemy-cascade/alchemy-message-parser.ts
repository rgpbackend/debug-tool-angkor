import { parseStompErrorCode } from "../../ws/stomp-errors";
import type { ParseMessageFn } from "../../ws/browser-ws-client";

export const parseAlchemyMessage: ParseMessageFn = async (raw) => {
  try {
    const text = typeof raw === "string" ? raw : await raw.text();
    const parsed: unknown = JSON.parse(text);
    const stompCode = parseStompErrorCode(parsed);
    if (stompCode !== null) return { type: "stomp-error", code: stompCode };

    if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === "number") {
      const payload = parsed.at(-1);
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return { type: "payload", payload: payload as Record<string, unknown> };
      }
    }
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const p = parsed as Record<string, unknown>;
      if (p.cmd !== undefined) {
        return { type: "payload", payload: p };
      }
    }
    return null;
  } catch {
    return null;
  }
};
