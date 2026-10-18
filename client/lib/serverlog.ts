import { api } from "./api";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  /** Monotonic id. Server ids are positive, locally-observed ones negative. */
  id: number;
  at: string;
  level: LogLevel;
  method?: string;
  path?: string;
  status?: number | null;
  durationMs?: number;
  message?: string;
}

export interface LogSnapshot {
  entries: LogEntry[];
  /** Lines the server is currently holding. */
  count: number;
  /** Capacity of the server's ring buffer. */
  max: number;
  /** Highest id the server has issued so far. */
  lastId: number;
}

export class LogUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogUnavailableError";
  }
}

/**
 * Reads the backend's in-memory request log. `since` is the highest id already
 * on screen, so each poll carries only the new lines.
 *
 * A 404 means the deployed backend predates the log route — that is surfaced as
 * its own error so the panel can explain it instead of looking broken.
 */
export async function fetchServerLogs(since: number): Promise<LogSnapshot> {
  let payload: Partial<LogSnapshot>;
  try {
    payload = await api.get<Partial<LogSnapshot>>(`/api/logs?since=${since}`);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      throw new LogUnavailableError(
        "This backend build has no log route yet. Deploy the current server to start the stream."
      );
    }
    throw error;
  }

  return {
    entries: Array.isArray(payload?.entries) ? (payload.entries as LogEntry[]) : [],
    count: typeof payload?.count === "number" ? payload.count : 0,
    max: typeof payload?.max === "number" ? payload.max : 0,
    lastId: typeof payload?.lastId === "number" ? payload.lastId : since,
  };
}

