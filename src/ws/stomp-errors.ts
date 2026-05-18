/** STOMP ERROR command in JSON wire format (first array element). */
export const STOMP_FRAME_ERROR = 1;

/** Server error code: access token banned. */
export const STOMP_ERROR_TOKEN_BANNED = 105;

export class StompTokenBannedError extends Error {
  constructor() {
    super("Access token is banned (STOMP error 105)");
    this.name = "StompTokenBannedError";
  }
}

/** Parse STOMP ERROR frame e.g. `[1,false,105,"",null,""]`. */
export function parseStompErrorCode(parsed: unknown): number | null {
  if (!Array.isArray(parsed) || parsed.length < 3) {
    return null;
  }
  if (parsed[0] !== STOMP_FRAME_ERROR) {
    return null;
  }
  const code = parsed[2];
  return typeof code === "number" && Number.isFinite(code) ? code : null;
}

export function isTokenBannedStompError(code: number): boolean {
  return code === STOMP_ERROR_TOKEN_BANNED;
}
