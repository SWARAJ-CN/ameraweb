"use client";

import { useState } from "react";
import { GitBranch, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Field, Input, Select } from "@/components/ui/Input";
import type { DevBranch } from "@/lib/dev-types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

interface BranchesPanelProps {
  branches: DevBranch[];
  currentBranch: string;
  defaultBranch: string;
  loading: boolean;
  busy: boolean;
  onSelect: (branch: string) => void;
  onCreate: (name: string, from: string) => Promise<void>;
  onRefresh: () => void;
}

export function BranchesPanel({
  branches,
  currentBranch,
  defaultBranch,
  loading,
  busy,
  onSelect,
  onCreate,
  onRefresh,
}: BranchesPanelProps) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState(defaultBranch);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      setError("A branch name is required.");
      return;
    }
    if (!/^[A-Za-z0-9._\/-]+$/.test(clean) || clean.startsWith("/") || clean.endsWith("/")) {
      setError("Use letters, numbers, dots, dashes and slashes only.");
      return;
    }
    setError(null);
    try {
      await onCreate(clean, from);
      setName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the branch.");
    }
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader
          title="Branches"
          description={`${branches.length} branch${branches.length === 1 ? "" : "es"} on the repository`}
          actions={
            <Button variant="outline" size="sm" onClick={onRefresh} loading={loading}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          }
        />
        {loading && !branches.length ? (
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </CardContent>
        ) : branches.length ? (
          <ul className="divide-y divide-separator">
            {branches.map((branch) => {
              const active = branch.name === currentBranch;
              return (
                <li key={branch.name}>
                  <button
                    type="button"
                    onClick={() => onSelect(branch.name)}
                    className={cn(
                      "flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-start transition-colors duration-150",
                      active ? "bg-accent-soft" : "hover:bg-surface-secondary"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 flex-none place-items-center rounded-lg",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "bg-surface-muted text-muted"
                      )}
                    >
                      <GitBranch className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm font-semibold text-foreground">
                          {branch.name}
                        </span>
                        {branch.name === defaultBranch ? (
                          <Badge tone="brand">default</Badge>
                        ) : null}
                        {branch.protected ? (
                          <Badge tone="warning">
                            <ShieldCheck className="size-3" />
                            protected
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {branch.commitMessage || "No commits"}
                      </span>
                    </span>
                    <span className="flex flex-none items-center gap-3 text-xs text-muted">
                      <span className="font-mono">{branch.sha.slice(0, 7)}</span>
                      {branch.commitDate ? <span>{relativeTime(branch.commitDate)}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<GitBranch className="size-6" />}
            title="No branches"
            description="GitHub returned no branches for this repository."
          />
        )}
      </Card>

      <Card>
        <CardHeader title="New branch" description="Branch off an existing ref." />
        <CardContent className="flex flex-col gap-4">
          <Field label="Branch name" htmlFor="dev-new-branch" required>
            <Input
              id="dev-new-branch"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="feature/my-change"
              spellCheck={false}
            />
          </Field>
          <Field label="From" htmlFor="dev-new-branch-from">
            <Select
              id="dev-new-branch-from"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </Field>
          {error ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Button onClick={() => void submit()} loading={busy} className="w-full">
            <Plus className="size-4" />
            Create branch
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
