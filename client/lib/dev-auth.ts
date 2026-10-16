/**
 * Server-side session guard for Developer Mode.
 *
 * Developer Mode can write to GitHub, so every `/api/dev/*` request must carry
 * the same studio bearer token the rest of the admin uses. We validate it
 * against the backend's `/api/auth/me` and cache the result briefly so a burst
 * of requests does not hammer the (free tier) backend.
 */

import { API_URL } from "./api";

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 50;

interface CacheEntry {
  expiresAt: number;
  user: { username: string; role: string } | null;
}

const cache = new Map<string, CacheEntry>();

function readCache(token: string): CacheEntry | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(token);
    return null;
  }
  return entry;
}

function writeCache(token: string, user: CacheEntry["user"]): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(token, { expiresAt: Date.now() + CACHE_TTL_MS, user });
}

export interface DevSession {
  token: string;
  username: string;
  role: string;
}

/**
 * Returns the verified session, or a Response to send back when the request is
 * not allowed through.
 */
export async function requireAuth(
  request: Request
): Promise<{ session: DevSession } | { denied: Response }> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return {
      denied: Response.json({ error: "Sign in to use Developer Mode." }, { status: 401 }),
    };
  }

  const cached = readCache(token);
  if (cached?.user) {
    return {
      session: { token, username: cached.user.username, role: cached.user.role },
    };
  }
  if (cached && cached.user === null) {
    return {
      denied: Response.json(
        { error: "Your session is not valid for Developer Mode." },
        { status: 401 }
      ),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40_000);
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      writeCache(token, null);
      return {
        denied: Response.json(
          { error: "Your session is not valid for Developer Mode." },
          { status: 401 }
        ),
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { user?: { username?: string; role?: string } }
      | null;
    const user = payload?.user;
    if (!user?.username) {
      writeCache(token, null);
      return {
        denied: Response.json(
          { error: "The backend did not recognise this session." },
          { status: 401 }
        ),
      };
    }

    writeCache(token, { username: user.username, role: user.role ?? "staff" });
    return { session: { token, username: user.username, role: user.role ?? "staff" } };
  } catch {
    return {
      denied: Response.json(
        { error: "Could not verify your session with the backend. Try again shortly." },
        { status: 503 }
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}
