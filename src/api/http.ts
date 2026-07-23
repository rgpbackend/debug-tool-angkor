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

async function requestJson<T>(
  url: string,
  method: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Request failed (${response.status})${text ? `: ${text}` : ""}`,
    );
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
