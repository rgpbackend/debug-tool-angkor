import { postJson } from "./http";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  displayName: string;
}

export interface LoginResponse {
  token: string;
}

export interface PlayGameRequest {
  gameId: string;
}

export interface PlayGameResponse {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid API response: missing ${field}`);
  }
  return value.trim();
}

/** Succeeds on 2xx; register may return 201 with an empty body. */
export async function register(body: RegisterRequest): Promise<void> {
  await postJson<void>("/user/register", body);
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const data = await postJson<LoginResponse>("/user/login", body);
  return { token: requireNonEmptyString(data.token, "token") };
}

export async function playGame(
  userToken: string,
  gameId: string,
): Promise<{ token: string; refreshToken: string }> {
  const data = await postJson<PlayGameResponse>(
    "/play-game",
    { gameId } satisfies PlayGameRequest,
    { bearer: userToken },
  );
  const token = requireNonEmptyString(
    data.token ?? data.accessToken,
    "token",
  );
  return {
    token,
    refreshToken: requireNonEmptyString(data.refreshToken, "refreshToken"),
  };
}
