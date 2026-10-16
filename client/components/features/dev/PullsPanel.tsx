"use client";

import { useState } from "react";
import { GitMerge, GitPullRequest, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState, Notice, Skeleton } from "@/components/ui/Feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { DevPull } from "@/lib/dev-types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ExternalButton } from "./DevBits";

interface PullsPanelProps {
  pulls: DevPull[];
  branches: { name: string; protected: boolean }[];
  defaultBranch: string;
  loading: boolean;
  busy: boolean;
  onRefresh: () => void;
  onCreate: (input: {
    title: string;
    head: string;
    base: string;
    body: string;
  }) => Promise<void>;
  onMerge: (number: number, method: "merge" | "squash" | "rebase") => Promise<void>;
}

export function PullsPanel({
  pulls,
  branches,
  defaultBranch,
  loading,
  busy,
  onRefresh,
  onCreate,
  onMerge,
}: PullsPanelProps) {
  const headCandidates = branches.filter((branch) => branch.name !== defaultBranch);

  const [title, setTitle] = useState("");
  const [head, setHead] = useState(headCandidates[0]?.name ?? "");
  const [base, setBase] = useState(defaultBranch);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [mergeTarget, setMergeTarget] = useState<DevPull | null>(null);
  const [mergeMethod, setMergeMethod] = useState<"merge" | "squash" | "rebase">("merge");
  const [mergeError, setMergeError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError("A pull request title is required.");
      return;
    }
    if (!head) {
      setError("Create a branch first — there is nothing to compare.");
      return;
    }
    setError(null);
    try {
      await onCreate({ title: title.trim(), head, base, body: body.trim() });
      setTitle("");
      setBody("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the pull request.");
    }
  };

  const confirmMerge = async () => {
    if (!mergeTarget) return;
    setMergeError(null);
    try {
      await onMerge(mergeTarget.number, mergeMethod);
      setMergeTarget(null);
    } catch (caught) {
      setMergeError(caught instanceof Error ? caught.message : "Could not merge.");
    }
  };

  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader
            title="Pull requests"
            description={`${pulls.length} open`}
            actions={
              <Button variant="outline" size="sm" onClick={onRefresh} loading={loading}>
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            }
          />
          {loading && !pulls.length ? (
            <CardContent className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </CardContent>
          ) : pulls.length ? (
            <ul className="divide-y divide-separator">
              {pulls.map((pull) => (
                <li key={pull.number} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="grid size-8 flex-none place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
                      <GitPullRequest className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{pull.number}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{pull.title}</span>
                        {pull.draft ? <Badge tone="neutral">draft</Badge> : null}
                        {pull.merged ? <Badge tone="brand">merged</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        <span className="font-mono">{pull.head}</span> →{" "}
                        <span className="font-mono">{pull.base}</span> · @{pull.user} ·{" "}
                        {relativeTime(pull.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <ExternalButton href={pull.htmlUrl} variant="ghost" size="sm">
                        Open
                      </ExternalButton>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMergeError(null);
                          setMergeTarget(pull);
                        }}
                        disabled={busy}
                      >
                        <GitMerge className="size-4" />
                        Merge
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<GitPullRequest className="size-6" />}
              title="No open pull requests"
              description="Open one from the panel on the right to review a branch before it lands on main."
            />
          )}
        </Card>

        <Card>
          <CardHeader title="New pull request" description="Compare a branch with the base." />
          <CardContent className="flex flex-col gap-4">
            <Field label="Title" htmlFor="dev-pr-title" required>
              <Input
                id="dev-pr-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add reports export"
              />
            </Field>
            <Field label="Head branch" htmlFor="dev-pr-head">
              <Select
                id="dev-pr-head"
                value={head}
                onChange={(event) => setHead(event.target.value)}
              >
                {headCandidates.length ? (
                  headCandidates.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                    </option>
                  ))
                ) : (
                  <option value="">No other branches</option>
                )}
              </Select>
            </Field>
            <Field label="Base branch" htmlFor="dev-pr-base">
              <Select
                id="dev-pr-base"
                value={base}
                onChange={(event) => setBase(event.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" htmlFor="dev-pr-body">
              <Textarea
                id="dev-pr-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="What does this change and why?"
              />
            </Field>
            {error ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {error}
              </p>
            ) : null}
            <Button onClick={() => void submit()} loading={busy} className="w-full">
              <Plus className="size-4" />
              Open pull request
            </Button>
          </CardContent>
        </Card>
      </div>

      <Modal
        open={mergeTarget !== null}
        onClose={() => setMergeTarget(null)}
        size="sm"
        title={`Merge #${mergeTarget?.number ?? ""}?`}
        description="This lands the branch on its base and can trigger deployments."
        footer={
          <>
            <Button variant="ghost" onClick={() => setMergeTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void confirmMerge()} loading={busy}>
              <GitMerge className="size-4" />
              Merge pull request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Notice tone="warning" title="Are you sure?">
            Merging cannot be undone from here. Prefer a pull request over pushing straight to
            main when the change is risky.
          </Notice>
          <Field label="Merge method" htmlFor="dev-merge-method">
            <Select
              id="dev-merge-method"
              value={mergeMethod}
              onChange={(event) =>
                setMergeMethod(event.target.value as "merge" | "squash" | "rebase")
              }
            >
              <option value="merge">Create a merge commit</option>
              <option value="squash">Squash and merge</option>
              <option value="rebase">Rebase and merge</option>
            </Select>
          </Field>
          {mergeError ? (
            <p role="alert" className={cn("text-xs font-medium text-danger")}>
              {mergeError}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
