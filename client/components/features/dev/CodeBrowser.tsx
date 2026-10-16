"use client";

import { useCallback, useMemo, useState } from "react";
import {
  FileCode2,
  GitCommitHorizontal,
  MessageCircle,
  RotateCcw,
  Save,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, Notice, Skeleton } from "@/components/ui/Feedback";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import { devApi } from "@/lib/dev-client";
import type { DevCommitResult, DevFile, DevRepo, DevTree } from "@/lib/dev-types";
import { relativeTime } from "@/lib/format";
import { ExternalButton } from "./DevBits";
import { FileTree } from "./FileTree";
import {
  activityId,
  commitMessage,
  formatBytes,
  pushMessage,
  whatsappLink,
  type DevActivity,
  type StagedChange,
} from "./dev-utils";

interface CodeBrowserProps {
  repo: DevRepo;
  branch: string;
  branches: { name: string; protected: boolean }[];
  onBranchChange: (branch: string) => void;
  tree: DevTree | null;
  treeLoading: boolean;
  treeError: string | null;
  onReloadTree: () => void;
  onActivity: (activity: DevActivity) => void;
}

export function CodeBrowser({
  repo,
  branch,
  branches,
  onBranchChange,
  tree,
  treeLoading,
  treeError,
  onReloadTree,
  onActivity,
}: CodeBrowserProps) {
  const { success: toastOk, error: toastErr } = useToast();

  const [editor, setEditor] = useState<{ path: string; original: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [fileMeta, setFileMeta] = useState<DevFile | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [staged, setStaged] = useState<Record<string, StagedChange>>({});
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState<null | "save" | "push">(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [confirmPush, setConfirmPush] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [result, setResult] = useState<{ commit: DevCommitResult; toMain: boolean } | null>(null);

  const stagedList = useMemo(() => Object.values(staged), [staged]);
  const changedPaths = useMemo(
    () => new Set(stagedList.filter((entry) => !entry.deleted).map((entry) => entry.path)),
    [stagedList]
  );
  const deletedPaths = useMemo(
    () => new Set(stagedList.filter((entry) => entry.deleted).map((entry) => entry.path)),
    [stagedList]
  );
  const dirty = editor ? draft !== editor.original : false;

  const openFile = useCallback(
    async (path: string) => {
      setFileLoading(true);
      setFileError(null);
      setFileMeta(null);
      setEditor(null);
      try {
        const fetched = await devApi.file(path, branch);
        setFileMeta(fetched);
        const existing = staged[path];
        setDraft(existing && !existing.deleted ? existing.content : fetched.content);
        setEditor({ path, original: fetched.content });
      } catch (caught) {
        setFileError(caught instanceof Error ? caught.message : "Could not open the file.");
      } finally {
        setFileLoading(false);
      }
    },
    [branch, staged]
  );

  const updateDraft = (value: string) => {
    setDraft(value);
    if (!editor) return;
    setStaged((current) => {
      const next = { ...current };
      if (value === editor.original) {
        delete next[editor.path];
      } else {
        next[editor.path] = {
          path: editor.path,
          content: value,
          original: editor.original,
          deleted: false,
        };
      }
      return next;
    });
  };

  const revertCurrent = () => {
    if (!editor) return;
    setDraft(editor.original);
    setStaged((current) => {
      const next = { ...current };
      delete next[editor.path];
      return next;
    });
  };

  const stageDeletion = () => {
    if (!editor) return;
    setStaged((current) => ({
      ...current,
      [editor.path]: {
        path: editor.path,
        content: "",
        original: editor.original,
        deleted: true,
      },
    }));
    toastOk("File staged for deletion", editor.path);
    setConfirmDelete(false);
    setEditor(null);
    setFileMeta(null);
    setDraft("");
  };

  const runCommit = async (target: string, toMain: boolean) => {
    const changes = stagedList.map((entry) =>
      entry.deleted
        ? { path: entry.path, content: "", delete: true }
        : { path: entry.path, content: entry.content }
    );
    if (!changes.length) return;

    const text =
      message.trim() ||
      commitMessage({
        files: changes.length,
        path: changes.length === 1 ? changes[0].path : undefined,
      });

    setCommitting(toMain ? "push" : "save");
    setCommitError(null);
    try {
      const commit = await devApi.commit({ branch: target, message: text, changes });
      setStaged({});
      setMessage("");
      if (editor) setEditor({ path: editor.path, original: draft });
      setConfirmPush(false);
      setResult({ commit, toMain });
      onReloadTree();
      onActivity({
        id: activityId(),
        kind: toMain ? "push" : "save",
        title: toMain ? `Pushed to ${target}` : `Committed to ${target}`,
        detail: `${commit.shortSha} · ${changes.length} file${changes.length === 1 ? "" : "s"}`,
        url: commit.htmlUrl,
        at: new Date().toISOString(),
      });
      toastOk(
        toMain ? `Pushed to ${target}` : `Committed to ${target}`,
        `${commit.shortSha} · ${changes.length} file${changes.length === 1 ? "" : "s"}`
      );
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "Commit failed.";
      setCommitError(reason);
      toastErr("Commit failed", reason);
      setConfirmPush(false);
    } finally {
      setCommitting(null);
    }
  };

  const notifyHref = result
    ? whatsappLink(
        pushMessage({
          repo: repo.fullName,
          branch: result.commit.branch,
          shortSha: result.commit.shortSha,
          message: result.commit.message,
          files: result.commit.files,
          url: result.commit.htmlUrl,
          actor: repo.user.login,
        })
      )
    : "#";

  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="overflow-clip">
          <CardHeader
            title="Files"
            description={
              tree
                ? `${tree.entries.filter((entry) => entry.type === "blob").length} files · ${
                    tree.branch
                  }`
                : branch
            }
            actions={
              <Badge tone="neutral">
                <GitCommitHorizontal className="size-3" />
                {tree ? tree.sha.slice(0, 7) : "—"}
              </Badge>
            }
          />
          {treeLoading ? (
            <CardContent className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-full rounded-md" />
              ))}
            </CardContent>
          ) : treeError ? (
            <CardContent>
              <Notice
                tone="danger"
                title="Could not load the tree"
                action={
                  <Button variant="outline" size="sm" onClick={onReloadTree}>
                    Retry
                  </Button>
                }
              >
                {treeError}
              </Notice>
            </CardContent>
          ) : tree ? (
            <FileTree
              entries={tree.entries}
              activePath={editor?.path ?? null}
              changedPaths={changedPaths}
              deletedPaths={deletedPaths}
              onOpen={openFile}
            />
          ) : null}
        </Card>

        <Card className="overflow-clip">
          <CardHeader
            title={editor ? editor.path : "Editor"}
            description={
              fileMeta
                ? `${formatBytes(fileMeta.size)} · ${draft.split("\n").length} lines`
                : "Pick a file from the tree to view and edit it."
            }
            actions={
              <>
                {dirty ? <Badge tone="warning">unsaved</Badge> : null}
                {editor ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={revertCurrent}
                      disabled={!dirty}
                    >
                      <RotateCcw className="size-4" />
                      Revert
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      disabled={committing !== null}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                    {fileMeta ? (
                      <ExternalButton href={fileMeta.htmlUrl}>GitHub</ExternalButton>
                    ) : null}
                  </>
                ) : null}
              </>
            }
          />

          <CardContent className="p-0">
            {fileLoading ? (
              <div className="flex flex-col gap-2 p-5">
                {Array.from({ length: 10 }).map((_, index) => (
                  <Skeleton key={index} className="h-4 w-full rounded-md" />
                ))}
              </div>
            ) : fileError ? (
              <div className="p-5">
                <Notice tone="danger" title="Could not open the file">
                  {fileError}
                </Notice>
              </div>
            ) : !editor ? (
              <EmptyState
                icon={<FileCode2 className="size-6" />}
                title="No file selected"
                description="Choose a file on the left to read it and make edits. Your changes stay staged until you save or push."
              />
            ) : fileMeta?.binary ? (
              <div className="p-5">
                <Notice tone="warning" title="Binary file">
                  This file is not text, so it cannot be edited here. Open it on GitHub to
                  inspect it.
                </Notice>
              </div>
            ) : fileMeta?.tooLarge ? (
              <div className="p-5">
                <Notice tone="warning" title="File is too large">
                  Files above 512 KB are shown read-only. Open it on GitHub instead.
                </Notice>
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={(event) => updateDraft(event.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                aria-label={`Edit ${editor.path}`}
                className="min-h-[26rem] w-full resize-y border-0 bg-surface-inset p-4 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset lg:min-h-[34rem]"
              />
            )}
          </CardContent>

          <div className="flex flex-col gap-3 border-t border-separator p-4">
            {stagedList.length ? (
              <Notice
                tone="info"
                title={`${stagedList.length} file${stagedList.length === 1 ? "" : "s"} staged`}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStaged({})}
                    disabled={committing !== null}
                  >
                    Discard all
                  </Button>
                }
              >
                <span className="flex flex-wrap gap-1.5">
                  {stagedList.slice(0, 6).map((entry) => (
                    <span
                      key={entry.path}
                      className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {entry.deleted ? "−" : "±"} {entry.path}
                    </span>
                  ))}
                  {stagedList.length > 6 ? (
                    <span className="text-[11px]">+{stagedList.length - 6} more</span>
                  ) : null}
                </span>
              </Notice>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <Field label="Commit message" htmlFor="dev-commit-message">
                <Input
                  id="dev-commit-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={
                    stagedList.length
                      ? commitMessage({
                          files: stagedList.length,
                          path: stagedList.length === 1 ? stagedList[0].path : undefined,
                        })
                      : "Describe the change…"
                  }
                  disabled={committing !== null}
                />
              </Field>
              <Field label="Commit to branch" htmlFor="dev-branch">
                <Select
                  id="dev-branch"
                  value={branch}
                  onChange={(event) => onBranchChange(event.target.value)}
                  disabled={committing !== null}
                >
                  {branches.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {commitError ? (
              <p
                role="alert"
                className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-foreground"
              >
                {commitError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <TriangleAlert className="size-3.5" />
                Pushing writes straight to {repo.defaultBranch} on GitHub.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void runCommit(branch, false)}
                  disabled={!stagedList.length || committing !== null}
                  loading={committing === "save"}
                >
                  <Save className="size-4" />
                  Save to {branch}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setConfirmPush(true)}
                  disabled={!stagedList.length || committing !== null}
                  loading={committing === "push"}
                >
                  <Upload className="size-4" />
                  Push to {repo.defaultBranch}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmPush}
        title={`Push to ${repo.defaultBranch}?`}
        description={`Are you sure? This commits ${stagedList.length} file${
          stagedList.length === 1 ? "" : "s"
        } directly to ${repo.defaultBranch} and notifies the developer on WhatsApp.`}
        confirmLabel="Yes, push to main"
        destructive
        loading={committing === "push"}
        onConfirm={() => void runCommit(repo.defaultBranch, true)}
        onCancel={() => setConfirmPush(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this file?"
        description={`${editor?.path ?? "This file"} will be staged for deletion. Nothing is removed until you save or push.`}
        confirmLabel="Stage deletion"
        destructive
        onConfirm={stageDeletion}
        onCancel={() => setConfirmDelete(false)}
      />

      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        size="md"
        title={result?.toMain ? "Pushed to main" : "Changes saved"}
        description={
          result?.toMain
            ? "The code is live on GitHub. Notify the developer so they can pick it up."
            : "The commit is on GitHub. Notify the developer if they need to know."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setResult(null)}>
              Done
            </Button>
            <ExternalButton
              href={notifyHref}
              variant="primary"
              size="md"
              className="gap-2"
            >
              <MessageCircle className="size-4" />
              Send WhatsApp to dev
            </ExternalButton>
          </>
        }
      >
        {result ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-surface-muted p-4">
              <p className="font-mono text-xs text-muted-foreground">
                {result.commit.branch} @ {result.commit.shortSha}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {result.commit.message}
              </p>
              <p className="mt-1 text-xs text-muted">
                {result.commit.files} file{result.commit.files === 1 ? "" : "s"} ·{" "}
                {relativeTime(new Date().toISOString())}
              </p>
            </div>
            <ExternalButton href={result.commit.htmlUrl} className="w-fit">
              View commit on GitHub
            </ExternalButton>
            <p className="text-xs text-muted-foreground">
              The WhatsApp button opens a pre-filled message to +91 85900 53568. Press send in
              WhatsApp to deliver it.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
