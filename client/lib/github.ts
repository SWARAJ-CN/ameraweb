/**
 * Server-only GitHub REST client for Developer Mode.
 *
 * Every Developer Mode action (browsing the tree, editing a file, committing,
 * opening/merging pull requests, reading workflow runs) flows through this
 * module. It must only ever be imported by the route handlers under
 * `app/api/dev/*`, never by a client component, so the token stays on the
 * server and never reaches the browser bundle.
 *
 * Token resolution: `GITHUB_TOKEN` from the environment. It is never embedded
 * in the source — the repository is public and a committed token would be
 * exposed (and GitHub's push protection would block the push).
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
  DevTreeEntry,
  DevUser,
} from "./dev-types";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const REQUEST_TIMEOUT_MS = 30_000;

/** Files above this size are shown read-only instead of in the editor. */
const MAX_EDIT_BYTES = 512 * 1024;

/** How many branches get their latest commit resolved in the branches list. */
const BRANCH_DETAIL_LIMIT = 40;

export const GITHUB_OWNER = "SWARAJ-CN";
export const GITHUB_REPO = "ameraweb";

export const GITHUB_TOKEN = (process.env.GITHUB_TOKEN ?? "").trim();
export const TOKEN_SOURCE: "env" | "missing" = GITHUB_TOKEN ? "env" : "missing";

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface GhOptions {
  method?: Method;
  body?: unknown;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function messageFrom(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      const errors = Array.isArray(record.errors)
        ? record.errors
            .map((entry) =>
              entry && typeof entry === "object" && "message" in entry
                ? String((entry as { message?: unknown }).message)
                : null
            )
            .filter(Boolean)
        : [];
      return errors.length ? `${record.message} (${errors.join("; ")})` : record.message;
    }
  }
  if (status === 401) return "GitHub rejected the token. It may have been revoked.";
  if (status === 403) return "GitHub refused the request — the token may lack permission.";
  if (status === 404) return "Not found on GitHub.";
  if (status === 409) return "The branch changed since you loaded it. Refresh and try again.";
  if (status === 422) return "GitHub rejected the request — check the branch and file paths.";
  return `GitHub request failed (${status}).`;
}

async function gh<T>(path: string, { method = "GET", body }: GhOptions = {}): Promise<T> {
  if (!GITHUB_TOKEN) {
    throw new GitHubError(
      "GitHub token is not configured. Set GITHUB_TOKEN in the environment and restart the app.",
      503
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "amare-admin-developer-mode",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    const payload = text ? safeJson(text) : null;

    if (!response.ok) {
      throw new GitHubError(messageFrom(payload, response.status), response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof GitHubError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GitHubError("GitHub took too long to respond.", 504);
    }
    throw new GitHubError("Could not reach GitHub. Check the server's connection.", 502);
  } finally {
    clearTimeout(timer);
  }
}

function repoPath(suffix = ""): string {
  return `/repos/${GITHUB_OWNER}/${GITHUB_REPO}${suffix}`;
}

function encodeRef(ref: string): string {
  return ref
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

/* ------------------------------------------------------------------ *
 * Raw GitHub payload shapes (only the fields we consume)
 * ------------------------------------------------------------------ */

interface RawRepo {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  html_url: string;
  homepage: string | null;
  language: string | null;
  license: { spdx_id?: string | null; name?: string | null } | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  subscribers_count?: number;
  open_issues_count: number;
  size: number;
  pushed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  owner: { login: string };
  permissions?: { admin?: boolean; maintain?: boolean; push?: boolean; pull?: boolean };
}

interface RawCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name?: string | null; date?: string | null } | null;
  };
  author: { login?: string; avatar_url?: string } | null;
}

/* ------------------------------------------------------------------ *
 * Read helpers
 * ------------------------------------------------------------------ */

async function refSha(branch: string): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(
    repoPath(`/git/ref/heads/${encodeRef(branch)}`)
  );
  return ref.object.sha;
}

async function treeShaForCommit(commitSha: string): Promise<string> {
  const commit = await gh<{ tree: { sha: string } }>(repoPath(`/git/commits/${commitSha}`));
  return commit.tree.sha;
}

export async function getRepo(): Promise<DevRepo> {
  const [raw, rate, user] = await Promise.all([
    gh<RawRepo>(repoPath()),
    gh<{ resources: { core: { limit: number; remaining: number; reset: number } } }>(
      "/rate_limit"
    ).catch(() => null),
    gh<DevUser & { avatar_url: string; html_url: string; name: string | null }>("/user").catch(
      () => null
    ),
  ]);

  const core = rate?.resources?.core;
  const permissions = raw.permissions ?? {};

  return {
    owner: raw.owner.login,
    name: raw.name,
    fullName: raw.full_name,
    description: raw.description,
    private: raw.private,
    defaultBranch: raw.default_branch,
    htmlUrl: raw.html_url,
    homepage: raw.homepage,
    language: raw.language,
    license: raw.license?.spdx_id ?? raw.license?.name ?? null,
    topics: raw.topics ?? [],
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    watchers: raw.subscribers_count ?? 0,
    openIssues: raw.open_issues_count,
    sizeKb: raw.size,
    pushedAt: raw.pushed_at,
    updatedAt: raw.updated_at,
    createdAt: raw.created_at,
    permissions: {
      admin: Boolean(permissions.admin),
      maintain: Boolean(permissions.maintain),
      push: Boolean(permissions.push),
      pull: Boolean(permissions.pull),
    },
    rateLimit: core
      ? {
          limit: core.limit,
          remaining: core.remaining,
          resetAt: new Date(core.reset * 1000).toISOString(),
        }
      : null,
    user: user
      ? {
          login: user.login,
          name: user.name ?? null,
          avatarUrl: user.avatar_url,
          htmlUrl: user.html_url,
        }
      : { login: GITHUB_OWNER, name: null, avatarUrl: "", htmlUrl: `https://github.com/${GITHUB_OWNER}` },
    tokenSource: TOKEN_SOURCE,
  };
}

export async function getTree(branch: string): Promise<DevTree> {
  const commitSha = await refSha(branch);
  const treeSha = await treeShaForCommit(commitSha);
  const tree = await gh<{
    sha: string;
    truncated: boolean;
    tree: Array<{ path: string; type: string; size?: number; sha: string }>;
  }>(repoPath(`/git/trees/${treeSha}?recursive=1`));

  const entries: DevTreeEntry[] = [];
  for (const entry of tree.tree) {
    if (entry.type !== "blob" && entry.type !== "tree" && entry.type !== "commit") continue;
    entries.push({
      path: entry.path,
      type: entry.type,
      size: entry.size ?? 0,
      sha: entry.sha,
    });
  }

  return { branch, sha: commitSha, truncated: tree.truncated, entries };
}

interface RawContent {
  type: string;
  path: string;
  sha: string;
  size: number;
  html_url: string;
  encoding?: string;
  content?: string;
}

export async function getFile(path: string, branch: string): Promise<DevFile> {
  const raw = await gh<RawContent | RawContent[]>(
    repoPath(`/contents/${encodeRef(path)}?ref=${encodeURIComponent(branch)}`)
  );

  if (Array.isArray(raw)) {
    throw new GitHubError("That path is a directory, not a file.", 400);
  }
  if (raw.type !== "file") {
    throw new GitHubError("Only regular files can be opened.", 400);
  }

  if (raw.size > MAX_EDIT_BYTES) {
    return {
      path: raw.path,
      sha: raw.sha,
      size: raw.size,
      htmlUrl: raw.html_url,
      content: "",
      binary: false,
      tooLarge: true,
    };
  }

  let content = "";
  if (raw.encoding === "base64" && raw.content) {
    content = Buffer.from(raw.content, "base64").toString("utf8");
  } else {
    // The contents API omits bodies above ~1 MB; read the blob directly.
    const blob = await gh<{ content: string; encoding: string }>(
      repoPath(`/git/blobs/${raw.sha}`)
    );
    content = Buffer.from(blob.content, "base64").toString("utf8");
  }

  const binary = content.includes("\u0000");

  return {
    path: raw.path,
    sha: raw.sha,
    size: raw.size,
    htmlUrl: raw.html_url,
    content: binary ? "" : content,
    binary,
    tooLarge: false,
  };
}

export async function listBranches(): Promise<DevBranch[]> {
  const branches = await gh<Array<{ name: string; protected: boolean; commit: { sha: string } }>>(
    repoPath("/branches?per_page=100")
  );

  const detailed = branches.slice(0, BRANCH_DETAIL_LIMIT);
  const commits = await Promise.all(
    detailed.map((branch) =>
      gh<{ commit: { message: string; author: { date?: string | null } | null } }>(
        repoPath(`/commits/${encodeRef(branch.name)}?per_page=1`)
      ).catch(() => null)
    )
  );

  const byName = new Map<string, DevBranch>();
  detailed.forEach((branch, index) => {
    const info = commits[index];
    byName.set(branch.name, {
      name: branch.name,
      protected: branch.protected,
      sha: branch.commit.sha,
      commitMessage: info?.commit.message.split("\n")[0] ?? "",
      commitDate: info?.commit.author?.date ?? null,
    });
  });

  return branches.map(
    (branch) =>
      byName.get(branch.name) ?? {
        name: branch.name,
        protected: branch.protected,
        sha: branch.commit.sha,
        commitMessage: "",
        commitDate: null,
      }
  );
}

export async function listCommits(branch: string, perPage = 25): Promise<DevCommitSummary[]> {
  const commits = await gh<RawCommit[]>(
    repoPath(`/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}`)
  );

  return commits.map((commit) => ({
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    message: commit.commit.message,
    authorName: commit.commit.author?.name ?? commit.author?.login ?? "Unknown",
    authorLogin: commit.author?.login ?? null,
    authorAvatar: commit.author?.avatar_url ?? null,
    date: commit.commit.author?.date ?? null,
    htmlUrl: commit.html_url,
  }));
}

export async function listPulls(state: "open" | "closed" | "all" = "open"): Promise<DevPull[]> {
  const pulls = await gh<
    Array<{
      number: number;
      title: string;
      state: string;
      draft: boolean;
      merged_at: string | null;
      user: { login: string; avatar_url: string } | null;
      head: { ref: string };
      base: { ref: string };
      created_at: string;
      updated_at: string;
      html_url: string;
    }>
  >(repoPath(`/pulls?state=${state}&per_page=30&sort=updated&direction=desc`));

  return pulls.map((pull) => ({
    number: pull.number,
    title: pull.title,
    state: pull.state,
    draft: Boolean(pull.draft),
    merged: Boolean(pull.merged_at),
    mergedAt: pull.merged_at,
    user: pull.user?.login ?? "unknown",
    userAvatar: pull.user?.avatar_url ?? null,
    head: pull.head.ref,
    base: pull.base.ref,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    htmlUrl: pull.html_url,
    mergeable: null,
  }));
}

export async function listRuns(branch?: string): Promise<DevRun[]> {
  const suffix = branch ? `&branch=${encodeURIComponent(branch)}` : "";
  const runs = await gh<{
    workflow_runs: Array<{
      id: number;
      name: string | null;
      display_title?: string;
      event: string;
      status: string;
      conclusion: string | null;
      head_branch: string | null;
      head_sha: string;
      run_number: number;
      html_url: string;
      created_at: string;
      updated_at: string;
      actor: { login: string; avatar_url: string } | null;
    }>;
  }>(repoPath(`/actions/runs?per_page=20${suffix}`));

  return runs.workflow_runs.map((run) => ({
    id: run.id,
    name: run.name ?? run.display_title ?? "Workflow",
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch ?? "",
    sha: run.head_sha,
    runNumber: run.run_number,
    actor: run.actor?.login ?? "unknown",
    actorAvatar: run.actor?.avatar_url ?? null,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    htmlUrl: run.html_url,
  }));
}

/* ------------------------------------------------------------------ *
 * Write helpers
 * ------------------------------------------------------------------ */

export async function createBranch(name: string, from: string): Promise<DevBranch> {
  const clean = name.trim();
  if (!clean) throw new GitHubError("A branch name is required.", 400);
  const sha = await refSha(from);
  await gh(repoPath("/git/refs"), {
    method: "POST",
    body: { ref: `refs/heads/${clean}`, sha },
  });
  return { name: clean, protected: false, sha, commitMessage: "", commitDate: null };
}

export async function commitFiles(input: DevCommitInput): Promise<DevCommitResult> {
  const branch = input.branch.trim();
  const message = input.message.trim();
  const changes = input.changes.filter((change) => change.path.trim());

  if (!branch) throw new GitHubError("Choose a branch to commit to.", 400);
  if (!message) throw new GitHubError("A commit message is required.", 400);
  if (!changes.length) throw new GitHubError("There are no changes to commit.", 400);

  let parentSha: string;
  try {
    parentSha = await refSha(branch);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404 && input.createBranchFrom) {
      parentSha = await refSha(input.createBranchFrom);
      await gh(repoPath("/git/refs"), {
        method: "POST",
        body: { ref: `refs/heads/${branch}`, sha: parentSha },
      });
    } else {
      throw error;
    }
  }

  const baseTree = await treeShaForCommit(parentSha);

  const tree = await Promise.all(
    changes.map(async (change) => {
      if (change.delete) {
        return { path: change.path, mode: "100644", type: "blob", sha: null };
      }
      const blob = await gh<{ sha: string }>(repoPath("/git/blobs"), {
        method: "POST",
        body: {
          content: Buffer.from(change.content, "utf8").toString("base64"),
          encoding: "base64",
        },
      });
      return { path: change.path, mode: "100644", type: "blob", sha: blob.sha };
    })
  );

  const newTree = await gh<{ sha: string }>(repoPath("/git/trees"), {
    method: "POST",
    body: { base_tree: baseTree, tree },
  });

  const commit = await gh<{ sha: string; html_url: string }>(repoPath("/git/commits"), {
    method: "POST",
    body: { message, tree: newTree.sha, parents: [parentSha] },
  });

  await gh(repoPath(`/git/refs/heads/${encodeRef(branch)}`), {
    method: "PATCH",
    body: { sha: commit.sha, force: false },
  });

  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    htmlUrl: commit.html_url,
    branch,
    message,
    files: changes.length,
  };
}

export async function createPull(input: DevPullInput): Promise<DevPull> {
  const pull = await gh<{
    number: number;
    title: string;
    state: string;
    draft: boolean;
    merged_at: string | null;
    user: { login: string; avatar_url: string } | null;
    head: { ref: string };
    base: { ref: string };
    created_at: string;
    updated_at: string;
    html_url: string;
  }>(repoPath("/pulls"), {
    method: "POST",
    body: {
      title: input.title,
      head: input.head,
      base: input.base,
      body: input.body ?? "",
      draft: Boolean(input.draft),
    },
  });

  return {
    number: pull.number,
    title: pull.title,
    state: pull.state,
    draft: Boolean(pull.draft),
    merged: Boolean(pull.merged_at),
    mergedAt: pull.merged_at,
    user: pull.user?.login ?? "unknown",
    userAvatar: pull.user?.avatar_url ?? null,
    head: pull.head.ref,
    base: pull.base.ref,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    htmlUrl: pull.html_url,
    mergeable: null,
  };
}

export async function mergePull(
  number: number,
  method: "merge" | "squash" | "rebase" = "merge"
): Promise<DevMergeResult> {
  const result = await gh<{ merged: boolean; message: string; sha: string | null }>(
    repoPath(`/pulls/${number}/merge`),
    { method: "PUT", body: { merge_method: method } }
  );
  return { merged: Boolean(result.merged), message: result.message, sha: result.sha ?? null };
}

/** Turns a thrown value into a JSON error response for a route handler. */
export function githubErrorResponse(error: unknown): Response {
  if (error instanceof GitHubError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[developer-mode]", error);
  return Response.json(
    { error: "Something went wrong while talking to GitHub." },
    { status: 500 }
  );
}
