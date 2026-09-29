const REFRESH_TOKEN_KEY = "debugtool.gui.refreshToken";
const AGENCY_USER_TOKEN_KEY = "debugtool.gui.agencyUserToken";
const LAUNCHED_GAME_ID_KEY = "debugtool.gui.gameId";

/** Legacy keys from earlier builds — removed on read/clear. */
const LEGACY_KEYS = [
  "angkor.gui.gameToken",
  "angkor.gui.gameId",
  "angkor.gui.refreshToken",
  "angkor.gui.agencyUserToken",
] as const;

function removeLegacyKeys(): void {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

export function saveRefreshToken(refreshToken: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  removeLegacyKeys();
}

export function loadRefreshToken(): string | null {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)?.trim();
  if (!refreshToken) {
    return null;
  }
  removeLegacyKeys();
  return refreshToken;
}

export function saveAgencyUserToken(token: string): void {
  localStorage.setItem(AGENCY_USER_TOKEN_KEY, token);
}

export function loadAgencyUserToken(): string | null {
  const token = localStorage.getItem(AGENCY_USER_TOKEN_KEY)?.trim();
  return token || null;
}

export function saveLaunchedGameId(gameId: string): void {
  localStorage.setItem(LAUNCHED_GAME_ID_KEY, gameId);
}

export function loadLaunchedGameId(): string | null {
  const gameId = localStorage.getItem(LAUNCHED_GAME_ID_KEY)?.trim();
  return gameId || null;
}

export function clearGameSession(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AGENCY_USER_TOKEN_KEY);
  localStorage.removeItem(LAUNCHED_GAME_ID_KEY);
  removeLegacyKeys();
}
