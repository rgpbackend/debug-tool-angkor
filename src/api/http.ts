import { readEnvDefaults } from "../config";

export interface PostJsonOptions {
  bearer?: string;
}

function trimTrailingSlash(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export async function postJson<T>(
  path: string,
  body: unknown,
  options?: PostJsonOptions,
): Promise<T> {
  const baseUrl = trimTrailingSlash(readEnvDefaults().apiBaseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const bearer = options?.bearer?.trim();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  return requestJson<T>(url, "POST", body, headers);
}

export async function getJson<T>(
  path: string,
  options?: PostJsonOptions,
): Promise<T> {
  const baseUrl = trimTrailingSlash(readEnvDefaults().apiBaseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const headers: Record<string, string> = {};
  const bearer = options?.bearer?.trim();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  return requestJson<T>(url, "GET", undefined, headers);
}

function httpErrorMessage(status: number, text: string): string {
  if (status === 401) return "Invalid username or password";
  if (status === 409) return "Username already taken";
  return `Request failed (${status})${text ? `: ${text}` : ""}`;
}

async function requestJson<T>(
  url: string,
  method: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        "Agency hid the response (CORS). Duplicate username and wrong password often look like Failed to fetch. Try a unique username.",
        { cause: e },
      );
    }
    throw e;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(httpErrorMessage(response.status, text));
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid API response: response body is not valid JSON");
  }
}
