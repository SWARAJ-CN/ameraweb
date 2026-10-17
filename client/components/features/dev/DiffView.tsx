"use client";

import { useMemo } from "react";
import { collapseDiff, diffLines, diffStats, type DiffLine } from "@/lib/diff";
import { CodeLines, widestLine, type CodeLine } from "./CodeLines";
import { useHighlightedLines } from "./use-highlighted-lines";

interface DiffViewProps {
  /** File content at the committed revision. */
  before: string;
  /** Staged content. */
  after: string;
  path: string;
  wrap: boolean;
  fontSize: number;
  lineHeight: number;
  className?: string;
  /** Unchanged lines kept around each hunk. */
  context?: number;
}

/**
 * Unified diff of a staged change, with both sides syntax highlighted so the
 * review pane reads like the file rather than like a patch file.
 */
export function DiffView({
  before,
  after,
  path,
  wrap,
  fontSize,
  lineHeight,
  className,
  context = 3,
}: DiffViewProps) {
  const beforeHighlight = useHighlightedLines(before, path);
  const afterHighlight = useHighlightedLines(after, path);

  const { lines, stats, hidden } = useMemo(() => {
    const full = diffLines(before, after);
    const collapsed = collapseDiff(full, context);
    const rows: CodeLine[] = collapsed.map((entry: DiffLine) => {
      const isSkip = entry.oldNumber === null && entry.newNumber === null;
      const side = entry.kind === "del" ? beforeHighlight.htmlLines : afterHighlight.htmlLines;
      const number = entry.kind === "del" ? entry.oldNumber : entry.newNumber;

      if (isSkip) {
        return {
          number: null,
          text: entry.text,
          tone: "skip",
          marker: "·",
        };
      }

      return {
        number,
        text: entry.text,
        html: side?.[(number ?? 1) - 1],
        tone: entry.kind === "same" ? undefined : entry.kind,
        marker: entry.kind === "add" ? "+" : entry.kind === "del" ? "−" : undefined,
      };
    });

    const markers = collapsed.filter(
      (entry) => entry.oldNumber === null && entry.newNumber === null
    ).length;

    return {
      lines: rows,
      stats: diffStats(full),
      hidden: full.length - (collapsed.length - markers),
    };
  }, [before, after, context, beforeHighlight.htmlLines, afterHighlight.htmlLines]);

  if (!lines.length) {
    return (
      <div className={className}>
        <p className="px-4 py-6 text-center text-xs text-muted">
          This file matches the committed revision — nothing staged.
        </p>
      </div>
    );
  }

  const widest = lines.reduce((max, line) => Math.max(max, line.text?.length ?? 0), 0);

  return (
    <div className={className}>
      <CodeLines
        lines={lines}
        widest={Math.max(widest, widestLine(before), widestLine(after))}
        fontSize={fontSize}
        lineHeight={lineHeight}
        wrap={wrap}
        label={`Diff of ${path}`}
      />
      <p className="border-t border-separator px-3 py-2 text-[11px] text-muted">
        <span className="font-semibold text-success">+{stats.added}</span>
        <span className="mx-1.5 text-faint-foreground">/</span>
        <span className="font-semibold text-danger">−{stats.removed}</span>
        <span className="mx-1.5">·</span>
        {hidden > 0
          ? `${hidden} unchanged line${hidden === 1 ? "" : "s"} collapsed`
          : "no lines collapsed"}
      </p>
    </div>
  );
}
