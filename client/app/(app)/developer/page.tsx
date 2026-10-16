"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  MessageCircle,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { CenteredSpinner, EmptyState, Notice } from "@/components/ui/Feedback";
import { PageHeader, SegmentedControl } from "@/components/ui/Controls";
import { useToast } from "@/components/providers/ToastProvider";
import { devApi } from "@/lib/dev-client";
import type {
  DevBranch,
  DevCommitSummary,
  DevPull,
  DevRepo,
  DevRun,
  DevTree,
} from "@/lib/dev-types";
import { relativeTime } from "@/lib/format";
import { CodeBrowser } from "@/components/features/dev/CodeBrowser";
import { BranchesPanel } from "@/components/features/dev/BranchesPanel";
import { PullsPanel } from "@/components/features/dev/PullsPanel";
import { ActionsPanel } from "@/components/features/dev/ActionsPanel";
import { CommitsPanel } from "@/components/features/dev/CommitsPanel";
import { RepoStatusCard } from "@/components/features/dev/RepoStatusCard";
import { ExternalButton } from "@/components/features/dev/DevBits";
import {
  activityId,
  whatsappLink,
  type DevActivity,
} from "@/components/features/dev/dev-utils";

type Section = "code" | "branches" | "pulls" | "actions" | "commits";

const SECTIONS = [
  { value: "code", label: "Code" },
  { value: "branches", label: "Branches" },
  { value: "pulls", label: "Pull requests" },
  { value: "commits", label: "Commits" },
  { value: "actions", label: "Actions" },
];

function reason(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

export default function DeveloperPage() {
  const { success: toastOk, error: toastErr } = useToast();

  const [repo, setRepo] = useState<DevRepo | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [loadingRepo, setLoadingRepo] = useState(true);

  const [branches, setBranches] = useState<DevBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branch, setBranch] = useState("main");
  const [creatingBranch, setCreatingBranch] = useState(false);

  const [tree, setTree] = useState<DevTree | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);

  const [commits, setCommits] = useState<DevCommitSummary[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(true);

  const [pulls, setPulls] = useState<DevPull[]>([]);
  const [loadingPulls, setLoadingPulls] = useState(true);
  const [pullBusy, setPullBusy] = useState(false);

  const [runs, setRuns] = useState<DevRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);

  const [section, setSection] = useState<Section>("code");
  const [activity, setActivity] = useState<DevActivity[]>([]);

  const [token, setToken] = useState(0);
  const [branchToken, setBranchToken] = useState(0);

  // Repository, branches, pull requests and workflow runs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [repoResult, branchResult, pullResult, runResult] = await Promise.allSettled([
        devApi.repo(),
        devApi.branches(),
        devApi.pulls("open"),
        devApi.runs(),
      ]);
      if (cancelled) return;

      if (repoResult.status === "fulfilled") {
        setRepo(repoResult.value);
        setRepoError(null);
      } else {
        setRepoError(reason(repoResult.reason));
      }

      if (branchResult.status === "fulfilled") {
        const list = branchResult.value;
        setBranches(list);
        const fallback =
          repoResult.status === "fulfilled" ? repoResult.value.defaultBranch : "main";
        setBranch((current) => (list.some((item) => item.name === current) ? current : fallback));
      } else if (repoResult.status === "rejected") {
        setRepoError(reason(branchResult.reason));
      }

      if (pullResult.status === "fulfilled") setPulls(pullResult.value);
      if (runResult.status === "fulfilled") setRuns(runResult.value);

      setLoadingRepo(false);
      setLoadingBranches(false);
      setLoadingPulls(false);
      setLoadingRuns(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // File tree and commit history follow the selected branch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [treeResult, commitResult] = await Promise.allSettled([
        devApi.tree(branch),
        devApi.commits(branch),
      ]);
      if (cancelled) return;

      if (treeResult.status === "fulfilled") {
        setTree(treeResult.value);
        setTreeError(null);
      } else {
        setTree(null);
        setTreeError(reason(treeResult.reason));
      }
      if (commitResult.status === "fulfilled") setCommits(commitResult.value);

      setTreeLoading(false);
      setLoadingCommits(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [branch, branchToken]);

  const reloadAll = useCallback(() => {
    setLoadingRepo(true);
    setLoadingBranches(true);
    setLoadingPulls(true);
    setLoadingRuns(true);
    setToken((value) => value + 1);
  }, []);

  const reloadBranch = useCallback(() => {
    setTreeLoading(true);
    setLoadingCommits(true);
    setBranchToken((value) => value + 1);
  }, []);

  const selectBranch = useCallback(
    (next: string) => {
      if (next === branch) return;
      setTreeLoading(true);
      setLoadingCommits(true);
      setBranch(next);
    },
    [branch]
  );

  const record = useCallback((entry: DevActivity) => {
    setActivity((current) => [entry, ...current].slice(0, 12));
  }, []);

  const createBranch = useCallback(
    async (name: string, from: string) => {
      setCreatingBranch(true);
      try {
        const created = await devApi.createBranch(name, from);
        toastOk("Branch created", created.name);
        record({
          id: activityId(),
          kind: "branch",
          title: `Created branch ${created.name}`,
          detail: `from ${from}`,
          at: new Date().toISOString(),
        });
        reloadAll();
        selectBranch(created.name);
      } finally {
        setCreatingBranch(false);
      }
    },
    [record, reloadAll, selectBranch, toastOk]
  );

  const createPull = useCallback(
    async (input: { title: string; head: string; base: string; body: string }) => {
      setPullBusy(true);
      try {
        const pull = await devApi.createPull(input);
        toastOk("Pull request opened", `#${pull.number} ${pull.title}`);
        record({
          id: activityId(),
          kind: "pull",
          title: `Opened pull request #${pull.number}`,
          detail: `${pull.head} → ${pull.base}`,
          url: pull.htmlUrl,
          at: new Date().toISOString(),
        });
        reloadAll();
      } finally {
        setPullBusy(false);
      }
    },
    [record, reloadAll, toastOk]
  );

  const mergePull = useCallback(
    async (number: number, method: "merge" | "squash" | "rebase") => {
      setPullBusy(true);
      try {
        const result = await devApi.mergePull(number, method);
        if (!result.merged) throw new Error(result.message || "GitHub did not merge the pull.");
        toastOk("Pull request merged", result.message);
        record({
          id: activityId(),
          kind: "merge",
          title: `Merged pull request #${number}`,
          detail: method,
          at: new Date().toISOString(),
        });
        reloadAll();
      } catch (caught) {
        toastErr("Merge failed", reason(caught));
        throw caught;
      } finally {
        setPullBusy(false);
      }
    },
    [record, reloadAll, toastErr, toastOk]
  );

  const notifyDev = useCallback(() => {
    if (!repo) return;
    const message = [
      "Amare Handmades — Developer Mode",
      `Repo: ${repo.fullName}`,
      `Default branch: ${repo.defaultBranch}`,
      `Last push: ${repo.pushedAt ? relativeTime(repo.pushedAt) : "unknown"}`,
      `Open pull requests: ${pulls.length}`,
      `Recent workflow runs: ${runs.length}`,
      `Sent by: @${repo.user.login}`,
      `Time: ${new Date().toLocaleString("en-IN")}`,
    ].join("\n");
    window.open(whatsappLink(message), "_blank", "noopener,noreferrer");
  }, [pulls.length, repo, runs.length]);

  if (loadingRepo && !repo) {
    return (
      <>
        <PageHeader
          title="Developer Mode"
          description="Read and edit the deployed codebase, then ship it from here."
        />
        <CenteredSpinner label="Contacting GitHub…" />
      </>
    );
  }

  if (!repo) {
    const missingToken = /not configured/i.test(repoError ?? "");
    return (
      <>
        <PageHeader
          title="Developer Mode"
          description="Read and edit the deployed codebase, then ship it from here."
        />
        {missingToken ? (
          <Notice tone="warning" title="GitHub token is not configured">
            <span className="block">
              Developer Mode needs a GitHub token in the environment. Add it and restart the
              app:
            </span>
            <code className="mt-2 block rounded-md bg-surface-muted px-3 py-2 font-mono text-xs">
              GITHUB_TOKEN=&lt;your-github-token&gt;
            </code>
            <span className="mt-2 block">
              Locally this goes in <span className="font-mono">client/.env.local</span>; on
              your host, add it in the project&apos;s environment variables.
            </span>
          </Notice>
        ) : (
          <Notice
            tone="danger"
            title="Could not load the repository"
            action={
              <Button variant="outline" size="sm" onClick={reloadAll}>
                Try again
              </Button>
            }
          >
            {repoError ?? "GitHub did not answer."}
          </Notice>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Developer Mode"
        description="Browse, edit and ship the codebase without leaving the admin."
        actions={
          <>
            <SegmentedControl
              ariaLabel="Developer section"
              options={SECTIONS}
              value={section}
              onChange={(value) => setSection(value as Section)}
            />
            <Button variant="ghost" onClick={notifyDev}>
              <MessageCircle className="size-4" />
              Notify dev
            </Button>
            <Button variant="outline" onClick={reloadAll} loading={loadingRepo}>
              <RefreshCw className="size-4" />
              Reload
            </Button>
          </>
        }
      />

      <Notice
        tone="warning"
        title="Full write access"
        action={<Badge tone="danger">admin</Badge>}
      >
        This tab can edit every file in <span className="font-mono">{repo.fullName}</span> and
        commit straight to <span className="font-mono">{repo.defaultBranch}</span>. Pushes here
        reach production, so review the diff before you ship.
      </Notice>

      <RepoStatusCard
        repo={repo}
        refreshing={loadingRepo}
        onRefresh={reloadAll}
        onNotifyDev={notifyDev}
      />

      {section === "code" ? (
        <CodeBrowser
          repo={repo}
          branch={branch}
          branches={branches}
          onBranchChange={selectBranch}
          tree={tree}
          treeLoading={treeLoading}
          treeError={treeError}
          onReloadTree={reloadBranch}
          onActivity={record}
        />
      ) : null}

      {section === "branches" ? (
        <BranchesPanel
          branches={branches}
          currentBranch={branch}
          defaultBranch={repo.defaultBranch}
          loading={loadingBranches}
          busy={creatingBranch}
          onSelect={selectBranch}
          onCreate={createBranch}
          onRefresh={reloadAll}
        />
      ) : null}

      {section === "pulls" ? (
        <PullsPanel
          pulls={pulls}
          branches={branches}
          defaultBranch={repo.defaultBranch}
          loading={loadingPulls}
          busy={pullBusy}
          onRefresh={reloadAll}
          onCreate={createPull}
          onMerge={mergePull}
        />
      ) : null}

      {section === "commits" ? (
        <CommitsPanel
          commits={commits}
          branch={branch}
          loading={loadingCommits}
          onRefresh={reloadBranch}
        />
      ) : null}

      {section === "actions" ? (
        <ActionsPanel runs={runs} loading={loadingRuns} onRefresh={reloadAll} />
      ) : null}

      {activity.length ? (
        <Card>
          <CardHeader
            title="Session activity"
            description="Everything you shipped from this browser session."
            actions={
              <Button variant="ghost" size="sm" onClick={() => setActivity([])}>
                Clear
              </Button>
            }
          />
          <CardContent className="p-0">
            <ul className="divide-y divide-separator">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
                >
                  <span className="grid size-8 flex-none place-items-center rounded-lg bg-surface-muted text-muted">
                    {entry.kind === "push" ? (
                      <Rocket className="size-4" />
                    ) : entry.kind === "merge" ? (
                      <GitPullRequest className="size-4" />
                    ) : entry.kind === "branch" ? (
                      <GitBranch className="size-4" />
                    ) : entry.kind === "pull" ? (
                      <GitPullRequest className="size-4" />
                    ) : (
                      <GitCommitHorizontal className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {entry.title}
                    </span>
                    <span className="block truncate text-xs text-muted">{entry.detail}</span>
                  </span>
                  <span className="flex-none text-xs text-muted">
                    {relativeTime(entry.at)}
                  </span>
                  {entry.url ? (
                    <ExternalButton href={entry.url} variant="ghost" size="sm">
                      Open
                    </ExternalButton>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<Terminal className="size-6" />}
            title="Nothing shipped yet"
            description="Commits, branches, pull requests and merges you make here show up in this list."
          />
        </Card>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-faint-foreground">
        <ShieldAlert className="size-3.5" />
        Developer Mode talks to GitHub from the server — the token never reaches this page.
      </p>
    </>
  );
}
