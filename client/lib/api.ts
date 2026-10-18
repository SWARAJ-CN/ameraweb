/**
 * Single client for the Amare Handmades API.
 *
 * The backend is never modified by this app; this module only consumes the
 * REST routes and the GraphQL endpoint exactly as they are documented in
 * `backend/docs/client-api-guide.html`.
 */

import { recordRequest } from "./reqlog";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://amera-backend.onrender.com"
).replace(/\/+$/, "");

const TOKEN_KEY = "amare.auth.token.v1";

let memoryToken: string | null = null;
if (typeof window !== "undefined") {
  try {
    memoryToken = window.localStorage.getItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
}

export function getToken(): string | null {
  return memoryToken;
}

export function setToken(token: string): void {
  memoryToken = token;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage can be unavailable in private mode — the in-memory token still works */
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Called whenever an authenticated request is rejected with a 401. */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Render's free tier sleeps, and the first request can take a while to wake it. */
const DEFAULT_TIMEOUT_MS = 45_000;

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
}

/** Feeds the Server page's live log. Never throws, so logging cannot break a call. */
function record(
  method: string,
  path: string,
  status: number | null,
  startedAt: number,
  message?: string
): void {
  recordRequest({
    method,
    path,
    status,
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    ...(message ? { message } : {}),
  });
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const detail = record.message ?? record.error;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  if (typeof payload === "string" && payload.trim()) return payload;
  return `Request failed (${status})`;
}

async function request<T>(
  method: Method,
  path: string,
  { body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {}
): Promise<T> {
  const recordPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_URL}${recordPath}`;
  const startedAt = performance.now();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  };

  // Reads are safe to retry: the first call against a sleeping instance often
  // fails while it wakes up, and the user should not see that as an error.
  const attempts = method === "GET" ? 2 : 1;
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  if (!response) {
    const aborted =
      lastError instanceof DOMException && lastError.name === "AbortError";
    const message = aborted
      ? `The server took longer than ${Math.round(timeoutMs / 1000)}s to respond.`
      : "Could not reach the server. Check your connection and try again.";
    record(method, recordPath, null, startedAt, message);
    throw new ApiError(message, 0);
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    const message = errorMessage(payload, response.status);
    record(method, recordPath, response.status, startedAt, message);
    if (response.status === 401 && auth) unauthorizedHandler?.();
    throw new ApiError(message, response.status);
  }

  record(method, recordPath, response.status, startedAt);
  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PUT", path, { ...options, body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("DELETE", path, options),
};

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

/** Runs a GraphQL query. The schema exposes queries only, so writes use REST. */
export async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetch(`${API_URL}/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    const message = aborted
      ? "The server took too long to respond."
      : "Could not reach the server.";
    record("POST", "/graphql", null, startedAt, message);
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timer);
  }

  const payload = (await parseBody(response)) as GraphQLResponse<T> | null;

  if (!response.ok) {
    const message = errorMessage(payload, response.status);
    record("POST", "/graphql", response.status, startedAt, message);
    throw new ApiError(message, response.status);
  }
  if (payload?.errors?.length) {
    const message = payload.errors[0]?.message ?? "GraphQL request failed.";
    record("POST", "/graphql", 400, startedAt, message);
    if (/not authenticated/i.test(message)) unauthorizedHandler?.();
    throw new ApiError(message, 400);
  }
  if (!payload?.data) {
    record("POST", "/graphql", 500, startedAt, "The server returned no data.");
    throw new ApiError("The server returned no data.", 500);
  }

  record("POST", "/graphql", response.status, startedAt);
  return payload.data;
}
