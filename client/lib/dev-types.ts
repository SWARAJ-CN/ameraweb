/**
 * Shared shapes for Developer Mode.
 *
 * These describe what the `/api/dev/*` route handlers return to the browser.
 * The GitHub token itself never crosses this boundary — it lives in the
 * server-only `lib/github.ts` module.
 */

export interface DevUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface DevRateLimit {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface DevPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  pull: boolean;
}

export interface DevRepo {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  license: string | null;
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  sizeKb: number;
  pushedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  permissions: DevPermissions;
  rateLimit: DevRateLimit | null;
  user: DevUser;
  /** "env" when GITHUB_TOKEN is configured, "missing" when it is not set. */
  tokenSource: "env" | "missing";
}

export interface DevTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  size: number;
  sha: string;
}

export interface DevTree {
  branch: string;
  sha: string;
  truncated: boolean;
  entries: DevTreeEntry[];
}

export interface DevFile {
  path: string;
  sha: string;
  size: number;
  htmlUrl: string;
  content: string;
  binary: boolean;
  tooLarge: boolean;
}

export interface DevChange {
  path: string;
  content: string;
  /** When true the file is removed instead of written. */
  delete?: boolean;
}

export interface DevCommitInput {
  branch: string;
  message: string;
  changes: DevChange[];
  /** Creates `branch` from this ref when it does not exist yet. */
  createBranchFrom?: string;
}

export interface DevCommitResult {
  sha: string;
  shortSha: string;
  htmlUrl: string;
  branch: string;
  message: string;
  files: number;
}

export interface DevCommitSummary {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorLogin: string | null;
  authorAvatar: string | null;
  date: string | null;
  htmlUrl: string;
}

export interface DevBranch {
  name: string;
  protected: boolean;
  sha: string;
  commitMessage: string;
  commitDate: string | null;
}

export interface DevPull {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  merged: boolean;
  mergedAt: string | null;
  user: string;
  userAvatar: string | null;
  head: string;
  base: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  mergeable: boolean | null;
}

export interface DevPullInput {
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
}

export interface DevMergeResult {
  merged: boolean;
  message: string;
  sha: string | null;
}

export interface DevRun {
  id: number;
  name: string;
  event: string;
  status: string;
  conclusion: string | null;
  branch: string;
  sha: string;
  runNumber: number;
  actor: string;
  actorAvatar: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}
