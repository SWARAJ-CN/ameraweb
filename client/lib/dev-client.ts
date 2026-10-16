/**
 * Browser-side helpers for Developer Mode.
 *
 * These talk to the same-origin `/api/dev/*` route handlers, which hold the
 * GitHub token server-side. The browser never sees the token.
 */

import type {
  DevBranch,
  DevCommitInput,
  DevCommitResult,
  DevCommitSummary,
  DevFile,
  DevMergeResult,
  DevPull,
  DevPullInput,
  DevRepo,
  DevRun,
  DevTree,
} from "./dev-types";
import { getToken } from "./api";

async function dev<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`/api/dev/${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not reach the admin server.");
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status}).`);
  }
  return payload as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return dev<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const devApi = {
  repo: () => dev<DevRepo>("repo"),
  tree: (branch: string) => dev<DevTree>(`tree?branch=${encodeURIComponent(branch)}`),
  file: (path: string, branch: string) =>
    dev<DevFile>(
      `file?path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch)}`
    ),
  commit: (input: DevCommitInput) => post<DevCommitResult>("commit", input),
  branches: () => dev<DevBranch[]>("branches"),
  createBranch: (name: string, from: string) =>
    post<DevBranch>("branches", { name, from }),
  commits: (branch: string, perPage = 25) =>
    dev<DevCommitSummary[]>(
      `commits?branch=${encodeURIComponent(branch)}&perPage=${perPage}`
    ),
  pulls: (state: "open" | "closed" | "all" = "open") =>
    dev<DevPull[]>(`pulls?state=${state}`),
  createPull: (input: DevPullInput) => post<DevPull>("pulls", input),
  mergePull: (number: number, method: "merge" | "squash" | "rebase" = "merge") =>
    post<DevMergeResult>("merge", { number, method }),
  runs: (branch?: string) =>
    dev<DevRun[]>(`runs${branch ? `?branch=${encodeURIComponent(branch)}` : ""}`),
};
