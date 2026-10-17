"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Lock,
  Palette,
  Search,
  Settings2,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { CloseButton } from "@heroui/react";
import type { DevTreeEntry } from "@/lib/dev-types";
import { cn } from "@/lib/cn";
import { formatBytes } from "./dev-utils";

interface IconSpec {
  Icon: LucideIcon;
  /** Semantic token class, so file colours follow the admin theme. */
  tone: string;
}

const FILE_ICONS: Record<string, IconSpec> = {
  ts: { Icon: FileCode2, tone: "text-brand" },
  tsx: { Icon: FileCode2, tone: "text-brand" },
  js: { Icon: FileCode2, tone: "text-brand" },
  jsx: { Icon: FileCode2, tone: "text-brand" },
  mjs: { Icon: FileCode2, tone: "text-brand" },
  cjs: { Icon: FileCode2, tone: "text-brand" },
  json: { Icon: FileJson, tone: "text-warning" },
  css: { Icon: Palette, tone: "text-info" },
  scss: { Icon: Palette, tone: "text-info" },
  less: { Icon: Palette, tone: "text-info" },
  html: { Icon: FileCode2, tone: "text-info" },
  xml: { Icon: FileCode2, tone: "text-info" },
  svg: { Icon: FileImage, tone: "text-info" },
  md: { Icon: FileText, tone: "text-muted" },
  mdx: { Icon: FileText, tone: "text-muted" },
  txt: { Icon: FileText, tone: "text-muted" },
  yml: { Icon: Settings2, tone: "text-success" },
  yaml: { Icon: Settings2, tone: "text-success" },
  toml: { Icon: Settings2, tone: "text-success" },
  ini: { Icon: Settings2, tone: "text-success" },
  env: { Icon: Settings2, tone: "text-success" },
  conf: { Icon: Settings2, tone: "text-success" },
  sh: { Icon: Terminal, tone: "text-success" },
  bash: { Icon: Terminal, tone: "text-success" },
  zsh: { Icon: Terminal, tone: "text-success" },
  lock: { Icon: Lock, tone: "text-faint-foreground" },
  png: { Icon: FileImage, tone: "text-info" },
  jpg: { Icon: FileImage, tone: "text-info" },
  jpeg: { Icon: FileImage, tone: "text-info" },
  webp: { Icon: FileImage, tone: "text-info" },
  avif: { Icon: FileImage, tone: "text-info" },
  ico: { Icon: FileImage, tone: "text-info" },
};

const DEFAULT_ICON: IconSpec = { Icon: File, tone: "text-faint-foreground" };

function iconFor(path: string): IconSpec {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return DEFAULT_ICON;
  return FILE_ICONS[name.slice(dot + 1).toLowerCase()] ?? DEFAULT_ICON;
}

interface TreeNode {
  name: string;
  path: string;
  dirs: TreeNode[];
  files: DevTreeEntry[];
}

function buildTree(entries: DevTreeEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", dirs: [], files: [] };
  const dirIndex = new Map<string, TreeNode>([["", root]]);

  const ensureDir = (path: string): TreeNode => {
    const existing = dirIndex.get(path);
    if (existing) return existing;
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const parent = ensureDir(parts.slice(0, -1).join("/"));
    const node: TreeNode = { name, path, dirs: [], files: [] };
    parent.dirs.push(node);
    dirIndex.set(path, node);
    return node;
  };

  for (const entry of entries) {
    if (entry.type !== "blob") continue;
    const parts = entry.path.split("/");
    const parent = ensureDir(parts.slice(0, -1).join("/"));
    parent.files.push(entry);
  }

  const sort = (node: TreeNode) => {
    node.dirs.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.path.localeCompare(b.path));
    node.dirs.forEach(sort);
  };
  sort(root);
  return root;
}

interface FileTreeProps {
  entries: DevTreeEntry[];
  activePath: string | null;
  changedPaths: Set<string>;
  deletedPaths: Set<string>;
  onOpen: (path: string) => void;
}

export function FileTree({
  entries,
  activePath,
  changedPaths,
  deletedPaths,
  onOpen,
}: FileTreeProps) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const tree = useMemo(() => buildTree(entries), [entries]);

  const matches = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return null;
    return entries
      .filter((entry) => entry.type === "blob" && entry.path.toLowerCase().includes(query))
      .slice(0, 200);
  }, [entries, filter]);

  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderFile = (entry: DevTreeEntry, depth: number) => {
    const active = entry.path === activePath;
    const changed = changedPaths.has(entry.path);
    const deleted = deletedPaths.has(entry.path);
    const { Icon, tone } = iconFor(entry.path);
    return (
      <button
        key={entry.path}
        type="button"
        onClick={() => onOpen(entry.path)}
        title={entry.path}
        className={cn(
          "flex w-full items-center gap-2 rounded-field py-1.5 pe-2 text-start text-xs transition-colors duration-150",
          active
            ? "bg-accent-soft text-accent-soft-foreground"
            : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
        )}
        style={{ paddingInlineStart: `${depth * 12 + 8}px` }}
      >
        <Icon className={cn("size-3.5 flex-none", active ? "opacity-100" : tone)} />
        <span className={cn("truncate", deleted && "line-through opacity-60")}>
          {entry.path.split("/").pop()}
        </span>
        {changed ? (
          <span
            aria-label="Modified"
            title="Modified"
            className="ms-auto size-1.5 flex-none rounded-full bg-warning"
          />
        ) : null}
        {!changed ? (
          <span className="ms-auto flex-none text-[10px] tabular-nums text-faint-foreground">
            {entry.size ? formatBytes(entry.size) : ""}
          </span>
        ) : null}
      </button>
    );
  };

  const renderDir = (node: TreeNode, depth: number) => {
    const isCollapsed = collapsed.has(node.path);
    return (
      <div key={node.path || "root"}>
        {node.path ? (
          <button
            type="button"
            onClick={() => toggle(node.path)}
            className="flex w-full items-center gap-1.5 rounded-field py-1.5 pe-2 text-start text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-surface-secondary"
            style={{ paddingInlineStart: `${depth * 12 + 6}px` }}
          >
            {isCollapsed ? (
              <ChevronRight className="size-3.5 flex-none text-muted" />
            ) : (
              <ChevronDown className="size-3.5 flex-none text-muted" />
            )}
            {isCollapsed ? (
              <Folder className="size-3.5 flex-none text-muted" />
            ) : (
              <FolderOpen className="size-3.5 flex-none text-muted" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
        ) : null}

        {!isCollapsed ? (
          <>
            {node.dirs.map((child) => renderDir(child, node.path ? depth + 1 : depth))}
            {node.files.map((file) => renderFile(file, node.path ? depth + 1 : depth))}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-separator p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-faint-foreground" />
          <Input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter files…"
            className="ps-8 pe-8 text-xs"
            aria-label="Filter repository files"
          />
          {filter ? (
            <CloseButton
              aria-label="Clear filter"
              className="absolute end-1.5 top-1/2 -translate-y-1/2"
              onPress={() => setFilter("")}
            />
          ) : null}
        </div>
      </div>

      <div className="max-h-[28rem] min-h-40 overflow-y-auto overscroll-contain p-2 lg:max-h-[calc(100vh-24rem)]">
        {matches ? (
          matches.length ? (
            matches.map((entry) => renderFile(entry, 0))
          ) : (
            <p className="px-2 py-6 text-center text-xs text-muted">No files match.</p>
          )
        ) : tree.dirs.length || tree.files.length ? (
          renderDir(tree, 0)
        ) : (
          <p className="px-2 py-6 text-center text-xs text-muted">This branch is empty.</p>
        )}
      </div>
    </div>
  );
}
