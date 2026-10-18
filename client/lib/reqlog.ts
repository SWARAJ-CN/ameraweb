import type { LogEntry, LogLevel } from "./serverlog";

/**
 * A request log kept in this browser.
 *
 * The backend can serve its own log, but only once the current server build is
 * deployed. Until then — or whenever that route is missing — the panel falls
 * back to this, which records every call the admin makes to the backend. Same
 * shape, same columns, so the two are interchangeable on screen.
 */

const MAX_ENTRIES = 300;

/** Polling the server log would otherwise fill the buffer with itself. */
const IGNORED = /^\/api\/logs\b/;

let nextId = -1;
let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function levelFor(status: number | null): LogLevel {
  if (status === null) return "error";
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

/** Called by the API client and the server probes after every attempt. */
export function recordRequest(input: {
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  message?: string;
}): void {
  if (typeof window === "undefined") return;
  if (IGNORED.test(input.path)) return;

  entries = [
    ...entries,
    {
      id: nextId--,
      at: new Date().toISOString(),
      level: levelFor(input.status),
      method: input.method,
      path: input.path,
      status: input.status,
      durationMs: input.durationMs,
      ...(input.message ? { message: input.message } : {}),
    },
  ].slice(-MAX_ENTRIES);

  for (const listener of listeners) listener();
}

export function subscribeRequestLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Newest last. The array identity changes only when a line is added. */
export function getRequestLog(): LogEntry[] {
  return entries;
}
