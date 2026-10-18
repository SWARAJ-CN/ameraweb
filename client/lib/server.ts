import { API_URL } from "./api";
import { recordRequest } from "./reqlog";

export interface EndpointProbe {
  /** HTTP status, or null when the request never completed. */
  status: number | null;
  /** True for a 2xx/3xx response. */
  ok: boolean;
  /** Round-trip time in milliseconds. */
  latencyMs: number;
  /** Raw response body (empty when unreachable). */
  body: string;
  /** Human-readable failure reason, when the request failed. */
  error?: string;
  /** ISO timestamp of the probe. */
  checkedAt: string;
}

export interface EndpointSpec {
  key: string;
  label: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  /** A note such as "401 expected without a token". */
  note?: string;
  /** When true, any HTTP response (even an error status) counts as reachable. */
  anyResponseIsOk?: boolean;
}

/** The public, unauthenticated endpoints used to judge server health. */
export const SERVER_ENDPOINTS: EndpointSpec[] = [
  { key: "health", label: "Health check", method: "GET", path: "/health" },
  { key: "root", label: "Service info", method: "GET", path: "/" },
  {
    key: "graphql",
    label: "GraphQL",
    method: "POST",
    path: "/graphql",
    body: { query: "{ __typename }" },
  },
  {
    key: "auth",
    label: "Auth guard",
    method: "GET",
    path: "/api/auth/me",
    note: "401 is expected without a token — it still proves the server is up.",
    anyResponseIsOk: true,
  },
];

const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * Pings one endpoint. Never throws: failures come back as a probe with a null
 * status so callers can render them uniformly.
 */
export async function probeEndpoint(
  spec: EndpointSpec,
  options: { timeoutMs?: number } = {}
): Promise<EndpointProbe> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${API_URL}${spec.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(url, {
      method: spec.method,
      headers: {
        Accept: "application/json",
        ...(spec.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
      signal: controller.signal,
      cache: "no-store",
    });

    const latencyMs = Math.round(performance.now() - started);
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "<unable to read body>";
    }

    const ok = spec.anyResponseIsOk
      ? true
      : response.status >= 200 && response.status < 400;

    recordRequest({
      method: spec.method,
      path: spec.path,
      status: response.status,
      durationMs: latencyMs,
      ...(ok ? {} : { message: "Unexpected status" }),
    });

    return {
      status: response.status,
      ok,
      latencyMs,
      body,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    const aborted = error instanceof DOMException && error.name === "AbortError";
    const message = aborted
      ? `Timed out after ${Math.round(timeoutMs / 1000)}s — the free tier may be waking up.`
      : "Could not reach the server. Check your connection.";

    recordRequest({
      method: spec.method,
      path: spec.path,
      status: null,
      durationMs: latencyMs,
      message,
    });

    return {
      status: null,
      ok: false,
      latencyMs,
      body: "",
      error: message,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}
