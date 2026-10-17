"use client";

import { useState } from "react";
import { GitBranch, GitCommitHorizontal, Plus, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { DevBranch, DevRepo } from "@/lib/dev-types";

interface BranchBarProps {
  repo: DevRepo;
  branch: string;
  branches: DevBranch[];
  sha: string | null;
  fileCount: number | null;
  loading: boolean;
  busy: boolean;
  onBranchChange: (branch: string) => void;
  onCreateBranch: (name: string, from: string) => Promise<void>;
  onFindFile: () => void;
  onReload: () => void;
}

const NAME_PATTERN = /^[A-Za-z0-9._/-]+$/;

/**
 * The branch control strip above the code browser.
 *
 * Browsing a branch and committing to it are the same choice here, so it is
 * made once, up front, instead of being buried next to the commit button.
 */
export function BranchBar({
  repo,
  branch,
  branches,
  sha,
  fileCount,
  loading,
  busy,
  onBranchChange,
  onCreateBranch,
  onFindFile,
  onReload,
}: BranchBarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [from, setFrom] = useState(branch);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onlyBranch = branches.length <= 1;
  const soleBranch = branches.length === 1;

  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      setError("Give the branch a name.");
      return;
    }
    if (!NAME_PATTERN.test(clean) || clean.startsWith("/") || clean.endsWith("/")) {
      setError("Letters, numbers, dots, dashes and slashes only.");
      return;
    }
    if (branches.some((item) => item.name === clean)) {
      setError("That branch already exists.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onCreateBranch(clean, from);
      setName("");
      setCreating(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the branch.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="size-4 flex-none text-muted" />
          {onlyBranch ? (
            <span className="rounded-lg bg-surface-muted px-2.5 py-1.5 font-mono text-xs font-semibold text-foreground">
              {branch}
            </span>
          ) : (
            <Select
              aria-label="Branch to browse and commit to"
              value={branch}
              onChange={(event) => onBranchChange(event.target.value)}
              disabled={loading || busy}
              className="w-52"
            >
              {branches.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}
                </option>
              ))}
            </Select>
          )}
          {soleBranch ? (
            <span className="hidden text-[11px] text-faint-foreground sm:inline">
              the only branch on GitHub
            </span>
          ) : null}
        </div>

        {branch !== repo.defaultBranch ? (
          <Badge tone="warning">branches off {repo.defaultBranch}</Badge>
        ) : (
          <Badge tone="brand">default</Badge>
        )}

        <Badge tone="neutral">
          <GitCommitHorizontal className="size-3" />
          <span className="font-mono">{sha ? sha.slice(0, 7) : "—"}</span>
        </Badge>

        {fileCount !== null ? (
          <Badge tone="neutral">
            {fileCount.toLocaleString()} file{fileCount === 1 ? "" : "s"}
          </Badge>
        ) : null}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onFindFile}
            title="Find a file (Ctrl/⌘ + P)"
            disabled={!fileCount}
          >
            <Search className="size-4" />
            Find file
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(branch);
              setError(null);
              setCreating(true);
            }}
            disabled={busy}
          >
            <Plus className="size-4" />
            New branch
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReload}
            loading={loading}
            title="Reload this branch"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        size="sm"
        title="New branch"
        description="Branch off any ref, then commit to it from the code browser."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void submit()} loading={saving}>
              <Plus className="size-4" />
              Create branch
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Branch name" htmlFor="dev-branch-name" required>
            <Input
              id="dev-branch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="feature/my-change"
              spellCheck={false}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </Field>
          <Field label="Start from" htmlFor="dev-branch-from">
            <Select
              id="dev-branch-from"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            >
              {branches.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                  {item.name === repo.defaultBranch ? " (default)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          {error ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
