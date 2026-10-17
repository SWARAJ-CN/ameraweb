"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FileCode2, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { DevTreeEntry } from "@/lib/dev-types";
import { cn } from "@/lib/cn";

interface FileFinderProps {
  open: boolean;
  files: DevTreeEntry[];
  changedPaths: Set<string>;
  onOpen: (path: string) => void;
  onClose: () => void;
}

const MAX_RESULTS = 60;

/**
 * Subsequence match, scored so that contiguous hits and matches at word
 * boundaries (after `/`, `.`, `-`, `_`) rank above scattered letters.
 */
function score(query: string, target: string): number | null {
  const needle = query.toLowerCase();
  const haystack = target.toLowerCase();

  let cursor = 0;
  let total = 0;
  let run = 0;

  for (let index = 0; index < needle.length; index += 1) {
    const char = needle[index];
    if (char === " ") continue;
    const found = haystack.indexOf(char, cursor);
    if (found === -1) return null;

    if (found === cursor) {
      run += 1;
      total += 2 + run;
    } else {
      run = 0;
      total += 1;
    }

    const previous = found > 0 ? haystack[found - 1] : "/";
    if (previous === "/" || previous === "." || previous === "-" || previous === "_") total += 4;

    cursor = found + 1;
  }

  // Prefer short paths and early matches when scores tie.
  return total - haystack.length * 0.02;
}

/** Ranks repository files against a quick-open query. */
export function rankFiles(query: string, files: DevTreeEntry[]): DevTreeEntry[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...files].sort((a, b) => a.path.localeCompare(b.path)).slice(0, MAX_RESULTS);
  }

  const scored: { entry: DevTreeEntry; value: number }[] = [];
  for (const entry of files) {
    const value = score(trimmed, entry.path);
    if (value !== null) scored.push({ entry, value });
  }

  scored.sort((a, b) => b.value - a.value || a.entry.path.localeCompare(b.entry.path));
  return scored.slice(0, MAX_RESULTS).map((item) => item.entry);
}

export function FileFinder({
  open,
  files,
  changedPaths,
  onOpen,
  onClose,
}: FileFinderProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => rankFiles(query, files), [query, files]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  const choose = (path: string) => {
    onOpen(path);
    setQuery("");
    setActive(0);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Find a file"
      description={`${files.length.toLocaleString()} files on this branch`}
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-faint-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const hit = results[activeIndex];
                if (hit) choose(hit.path);
              }
            }}
            placeholder="Type a path — src/lib/format.ts"
            aria-label="Search files by path"
            className="w-full ps-9 font-mono text-xs"
          />
        </div>

        <div
          ref={listRef}
          className="max-h-[22rem] overflow-y-auto overscroll-contain rounded-lg border border-border"
        >
          {results.length ? (
            results.map((entry, index) => {
              const name = entry.path.split("/").pop() ?? entry.path;
              const directory = entry.path.slice(0, entry.path.length - name.length);
              return (
                <button
                  key={entry.path}
                  type="button"
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(entry.path)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-start text-xs transition-colors duration-100",
                    index === active ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-surface-secondary"
                  )}
                >
                  <FileCode2 className="size-3.5 flex-none opacity-70" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-faint-foreground">{directory}</span>
                    <span className="font-semibold">{name}</span>
                  </span>
                  {changedPaths.has(entry.path) ? (
                    <span
                      aria-label="Modified"
                      className="size-1.5 flex-none rounded-full bg-warning"
                    />
                  ) : null}
                  {index === active ? (
                    <CornerDownLeft className="size-3 flex-none opacity-60" />
                  ) : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-xs text-muted">
              No file matches “{query}”.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
