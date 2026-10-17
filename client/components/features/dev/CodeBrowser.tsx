"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Download,
  FileCode2,
  GitCompareArrows,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  TriangleAlert,
  Upload,
  WrapText,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SegmentedControl } from "@/components/ui/Controls";
import { EmptyState, Notice, Skeleton } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import { devApi } from "@/lib/dev-client";
import type { DevBranch, DevCommitResult, DevFile, DevRepo, DevTree } from "@/lib/dev-types";
import { countLines, detectLanguage } from "@/lib/highlight";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BranchBar } from "./BranchBar";
import { CodeView } from "./CodeView";
import { DiffView } from "./DiffView";
import { Editor } from "./Editor";
import { ExternalButton } from "./DevBits";
import { FileFinder } from "./FileFinder";
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
  branches: DevBranch[];
  onBranchChange: (branch: string) => void;
  onCreateBranch: (name: string, from: string) => Promise<void>;
  tree: DevTree | null;
  treeLoading: boolean;
  treeError: string | null;
  onReloadTree: () => void;
  onActivity: (activity: DevActivity) => void;
}

type ViewMode = "code" | "edit" | "diff";

const FONT_SIZES = [11, 12, 13, 14, 16, 18];
const DEFAULT_FONT_INDEX = 1;

export function CodeBrowser({
  repo,
  branch,
  branches,
  onBranchChange,
  onCreateBranch,
  tree,
  treeLoading,
  treeError,
  onReloadTree,
  onActivity,
}: CodeBrowserProps) {
  const { success: toastOk, error: toastErr, toast } = useToast();

  const [opened, setOpened] = useState<{
    path: string;
    branch: string;
    original: string;
  } | null>(null);
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [result, setResult] = useState<{ commit: DevCommitResult; toMain: boolean } | null>(null);

  const [requestedMode, setRequestedMode] = useState<ViewMode>("code");
  const [wrap, setWrap] = useState(false);
  const [fontIndex, setFontIndex] = useState(DEFAULT_FONT_INDEX);
  const [finderOpen, setFinderOpen] = useState(false);

  const fontSize = FONT_SIZES[fontIndex];
  const lineHeight = Math.round(fontSize * 1.65);

  /* The open file belongs to the branch it was fetched from: if the branch
     changes the editor closes for free, without an effect resetting state. */
  const openFile = opened && opened.branch === branch ? opened : null;

  const files = useMemo(
    () => (tree?.entries ?? []).filter((entry) => entry.type === "blob"),
    [tree]
  );

  const stagedList = useMemo(() => Object.values(staged), [staged]);
  const changedPaths = useMemo(
    () => new Set(stagedList.filter((entry) => !entry.deleted).map((entry) => entry.path)),
    [stagedList]
  );
  const deletedPaths = useMemo(
    () => new Set(stagedList.filter((entry) => entry.deleted).map((entry) => entry.path)),
    [stagedList]
  );

  const current = openFile ? staged[openFile.path] : undefined;
  const dirty = Boolean(openFile && draft !== openFile.original);
  const writable = Boolean(openFile && fileMeta && !fileMeta.binary && !fileMeta.tooLarge);
  const diffPair = useMemo(
    () =>
      current
        ? { before: current.original, after: current.deleted ? "" : current.content }
        : null,
    [current]
  );

  const mode: ViewMode =
    (requestedMode === "edit" && !writable) || (requestedMode === "diff" && !diffPair)
      ? "code"
      : requestedMode;

  const language = useMemo(
    () => (openFile ? detectLanguage(openFile.path) : null),
    [openFile]
  );

  const openPath = useCallback(
    async (path: string) => {
      setFileLoading(true);
      setFileError(null);
      setFileMeta(null);
      setOpened(null);
      try {
        const fetched = await devApi.file(path, branch);
        setFileMeta(fetched);
        const existing = staged[path];
        setDraft(existing && !existing.deleted ? existing.content : fetched.content);
        setOpened({ path, branch, original: fetched.content });
        setRequestedMode("code");
      } catch (caught) {
        setFileError(caught instanceof Error ? caught.message : "Could not open the file.");
      } finally {
        setFileLoading(false);
      }
    },
    [branch, staged]
  );

  const updateDraft = useCallback(
    (value: string) => {
      setDraft(value);
      if (!openFile) return;
      setStaged((current) => {
        const next = { ...current };
        if (value === openFile.original) delete next[openFile.path];
        else
          next[openFile.path] = {
            path: openFile.path,
            content: value,
            original: openFile.original,
            deleted: false,
          };
        return next;
      });
    },
    [openFile]
  );

  const unstage = useCallback(
    (path: string) => {
      setStaged((current) => {
        const next = { ...current };
        delete next[path];
        return next;
      });
      if (openFile?.path === path) setDraft(openFile.original);
    },
    [openFile]
  );

  const revertCurrent = useCallback(() => {
    if (!openFile) return;
    setDraft(openFile.original);
    setStaged((current) => {
      const next = { ...current };
      delete next[openFile.path];
      return next;
    });
  }, [openFile]);

  const stageDeletion = () => {
    if (!openFile) return;
    setStaged((current) => ({
      ...current,
      [openFile.path]: {
        path: openFile.path,
        content: "",
        original: openFile.original,
        deleted: true,
      },
    }));
    toastOk("File staged for deletion", openFile.path);
    setConfirmDelete(false);
    setOpened(null);
    setFileMeta(null);
    setDraft("");
  };

  const copyPath = async () => {
    if (!openFile) return;
    try {
      await navigator.clipboard.writeText(openFile.path);
      toastOk("Path copied", openFile.path);
    } catch {
      toastErr("Could not copy", "Your browser blocked clipboard access.");
    }
  };

  const download = () => {
    if (!openFile) return;
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = openFile.path.split("/").pop() ?? "file.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const runCommit = useCallback(
    async (target: string, toMain: boolean) => {
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
        setOpened((current) =>
          current ? { path: current.path, branch: current.branch, original: draft } : current
        );
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
    },
    [draft, message, onActivity, onReloadTree, stagedList, toastErr, toastOk]
  );

  // Keyboard shortcuts: quick-open and stage-and-commit.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "p" && files.length) {
        event.preventDefault();
        setFinderOpen(true);
      } else if (key === "s") {
        event.preventDefault();
        if (stagedList.length && committing === null) void runCommit(branch, false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [branch, committing, files.length, runCommit, stagedList.length]);

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

  const lineCount = openFile ? countLines(draft) : 0;

  const modeOptions = useMemo(
    () => [
      { value: "code", label: "Code" },
      { value: "edit", label: "Edit" },
      {
        value: "diff",
        label: diffPair ? "Diff •" : "Diff",
      },
    ],
    [diffPair]
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <BranchBar
          repo={repo}
          branch={branch}
          branches={branches}
          sha={tree?.sha ?? null}
          fileCount={tree ? files.length : null}
          loading={treeLoading}
          busy={committing !== null}
          onBranchChange={onBranchChange}
          onCreateBranch={onCreateBranch}
          onFindFile={() => setFinderOpen(true)}
          onReload={onReloadTree}
        />

        <div className="grid items-start gap-4 lg:grid-cols-[19rem_1fr]">
          <Card className="overflow-clip">
            <CardHeader
              title="Files"
              description={
                treeLoading
                  ? "Loading…"
                  : `${files.length.toLocaleString()} files on ${branch}`
              }
              actions={
                stagedList.length ? (
                  <Badge tone="warning">{stagedList.length} staged</Badge>
                ) : null
              }
            />
            {treeLoading && !tree ? (
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
                activePath={openFile?.path ?? null}
                changedPaths={changedPaths}
                deletedPaths={deletedPaths}
                onOpen={openPath}
              />
            ) : null}
          </Card>

          <Card className="overflow-clip">
            <CardHeader
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono">{openFile?.path ?? "Editor"}</span>
                  {language ? <Badge tone="neutral">{language.label}</Badge> : null}
                </span>
              }
              description={
                openFile
                  ? `${lineCount.toLocaleString()} lines · ${formatBytes(
                      fileMeta?.size ?? draft.length
                    )}`
                  : "Pick a file to read, edit and ship it."
              }
              actions={
                openFile ? (
                  <>
                    {dirty ? <Badge tone="warning">uncommitted</Badge> : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={revertCurrent}
                      disabled={!dirty}
                      title="Discard changes to this file"
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
                ) : null
              }
            />

            {openFile ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-separator px-4 py-2">
                <SegmentedControl
                  ariaLabel="File view"
                  options={modeOptions}
                  value={mode}
                  onChange={(value) => setRequestedMode(value as ViewMode)}
                />
                <div className="ms-auto flex flex-wrap items-center gap-1">
                  <Button
                    variant={wrap ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setWrap((value) => !value)}
                    aria-pressed={wrap}
                    title="Wrap long lines"
                  >
                    <WrapText className="size-4" />
                    Wrap
                  </Button>
                  <div className="flex items-center overflow-hidden rounded-field border border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-none"
                      onClick={() => setFontIndex((index) => Math.max(0, index - 1))}
                      disabled={fontIndex === 0}
                      title="Smaller text"
                      aria-label="Smaller code text"
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-9 text-center font-mono text-[11px] text-muted">
                      {fontSize}px
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-none"
                      onClick={() =>
                        setFontIndex((index) => Math.min(FONT_SIZES.length - 1, index + 1))
                      }
                      disabled={fontIndex === FONT_SIZES.length - 1}
                      title="Larger text"
                      aria-label="Larger code text"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void copyPath()} title="Copy path">
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={download}
                    title="Download this file"
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            <CardContent className="p-0">
              {fileLoading ? (
                <div className="flex flex-col gap-2 p-5">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton key={index} className="h-4 w-full rounded-md" />
                  ))}
                </div>
              ) : fileError ? (
                <div className="p-5">
                  <Notice tone="danger" title="Could not open the file">
                    {fileError}
                  </Notice>
                </div>
              ) : !openFile ? (
                <EmptyState
                  icon={<FileCode2 className="size-6" />}
                  title="No file selected"
                  description="Choose a file on the left, or press Ctrl/⌘ + P to jump straight to one by path."
                />
              ) : fileMeta?.binary ? (
                <div className="p-5">
                  <Notice tone="warning" title="Binary file">
                    This file is not text, so it cannot be shown here. Open it on GitHub to
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
                <div className="h-[24rem] sm:h-[28rem] lg:h-[34rem]">
                  {mode === "edit" ? (
                    <Editor
                      value={draft}
                      onChange={updateDraft}
                      fontSize={fontSize}
                      lineHeight={lineHeight}
                      className="h-full"
                      label={`Edit ${openFile.path}`}
                      onSave={() => {
                        if (stagedList.length) void runCommit(branch, false);
                      }}
                    />
                  ) : mode === "diff" && diffPair ? (
                    <DiffView
                      before={diffPair.before}
                      after={diffPair.after}
                      path={openFile.path}
                      wrap={wrap}
                      fontSize={fontSize}
                      lineHeight={lineHeight}
                      className="h-full"
                    />
                  ) : (
                    <CodeView
                      code={draft}
                      path={openFile.path}
                      wrap={wrap}
                      fontSize={fontSize}
                      lineHeight={lineHeight}
                      className="h-full"
                      label={`Contents of ${openFile.path}`}
                    />
                  )}
                </div>
              )}
            </CardContent>

            <div className="flex flex-col gap-3 border-t border-separator p-4">
              {stagedList.length ? (
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
                    <GitCompareArrows className="size-3.5" />
                    Staged changes
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {stagedList.map((entry) => (
                      <li key={entry.path}>
                        <span
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted py-1 ps-2 pe-1 font-mono text-[11px]",
                            entry.deleted ? "text-danger" : "text-foreground"
                          )}
                        >
                          {entry.deleted ? "−" : "±"}
                          <span className="max-w-[16rem] truncate">{entry.path}</span>
                          <button
                            type="button"
                            onClick={() => unstage(entry.path)}
                            aria-label={`Unstage ${entry.path}`}
                            title="Unstage"
                            className="grid size-4 place-items-center rounded text-muted hover:bg-surface-strong hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
                  className="w-full"
                />
              </Field>

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
                  Pushing writes straight to{" "}
                  <span className="font-mono">{repo.defaultBranch}</span> on GitHub.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDiscard(true)}
                    disabled={!stagedList.length || committing !== null}
                  >
                    Discard all
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void runCommit(branch, false)}
                    disabled={!stagedList.length || committing !== null}
                    loading={committing === "save"}
                  >
                    <Save className="size-4" />
                    Commit to {branch}
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
      </div>

      <FileFinder
        open={finderOpen}
        files={files}
        changedPaths={changedPaths}
        onOpen={(path) => void openPath(path)}
        onClose={() => setFinderOpen(false)}
      />

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
        description={`${openFile?.path ?? "This file"} will be staged for deletion. Nothing is removed until you commit or push.`}
        confirmLabel="Stage deletion"
        destructive
        onConfirm={stageDeletion}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard every staged change?"
        description={`${stagedList.length} file${
          stagedList.length === 1 ? "" : "s"
        } will be reset to the committed revision. This cannot be undone.`}
        confirmLabel="Discard all"
        destructive
        onConfirm={() => {
          setStaged({});
          setConfirmDiscard(false);
          if (openFile) setDraft(openFile.original);
          toast({ title: "Staged changes discarded", variant: "info" });
        }}
        onCancel={() => setConfirmDiscard(false)}
      />

      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        size="md"
        title={
          result
            ? result.toMain
              ? `Pushed to ${result.commit.branch}`
              : `Committed to ${result.commit.branch}`
            : ""
        }
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
            <ExternalButton href={notifyHref} variant="primary" size="md" className="gap-2">
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
