const REFRESH_TOKEN_KEY = "angkor.gui.refreshToken";
const AGENCY_USER_TOKEN_KEY = "angkor.gui.agencyUserToken";

/** Legacy keys from earlier builds — removed on read/clear. */
const LEGACY_KEYS = ["angkor.gui.gameToken", "angkor.gui.gameId"] as const;

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

export function clearGameSession(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AGENCY_USER_TOKEN_KEY);
  removeLegacyKeys();
}
