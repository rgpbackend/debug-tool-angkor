import { readEnvDefaults } from "../config";

/** Interval between WS session token refresh + re-auth on the open socket. */
export function getWsSessionRefreshIntervalMs(): number {
  return readEnvDefaults().authRefreshIntervalMs;
}
