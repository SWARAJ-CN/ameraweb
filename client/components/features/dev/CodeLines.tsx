"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface CodeLine {
  /** Line number in the gutter. `null` renders an empty gutter cell. */
  number: number | null;
  /** Highlighted HTML for this line. Takes priority over `text`. */
  html?: string;
  /** Plain text, rendered when the line has not been highlighted. */
  text?: string;
  /** Marks a line as added, removed, or collapsed away, for the diff view. */
  tone?: "add" | "del" | "skip";
  /** Single-character change marker shown left of the line number. */
  marker?: "+" | "−" | "·";
}

interface CodeLinesProps {
  lines: CodeLine[];
  /** Font size in px — also drives the gutter metrics. */
  fontSize: number;
  /** Row height in px. Must be fixed unless `wrap` is on. */
  lineHeight: number;
  wrap: boolean;
  className?: string;
  label?: string;
  /** Longest source line, in characters. Keeps the horizontal scrollbar steady. */
  widest?: number;
}

/** Rows rendered above and below the viewport while virtualising. */
const OVERSCAN = 16;
/** Below this many rows virtualising costs more than it saves. */
const VIRTUAL_THRESHOLD = 300;
/** Rough advance width of a monospace glyph, in em. */
const GLYPH_EM = 0.62;

/**
 * The code surface: a line-number gutter plus the source, one flex row per
 * line so numbers stay glued to their line even when the code wraps.
 *
 * Long files are windowed — only the rows near the viewport are in the DOM,
 * with exact-height spacers standing in for the rest, so opening a 3,000-line
 * file does not cost 3,000 elements.
 */
export function CodeLines({
  lines,
  fontSize,
  lineHeight,
  wrap,
  className,
  label,
  widest: widestProp,
}: CodeLinesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(520);
  const [scrollTop, setScrollTop] = useState(0);

  const virtual = !wrap && lines.length > VIRTUAL_THRESHOLD;

  // ResizeObserver delivers an initial measurement as soon as it observes, so
  // the viewport height never has to be guessed or set from an effect body.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? node.clientHeight;
      setViewportHeight((current) => (Math.abs(current - height) < 1 ? current : height));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { start, end } = useMemo(() => {
    if (!virtual) return { start: 0, end: lines.length };
    const first = Math.max(0, Math.floor(scrollTop / lineHeight) - OVERSCAN);
    const visible = Math.ceil(viewportHeight / lineHeight) + OVERSCAN * 2;
    return { start: first, end: Math.min(lines.length, first + visible) };
  }, [virtual, scrollTop, lineHeight, viewportHeight, lines.length]);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!virtual) return;
      const top = event.currentTarget.scrollTop;
      setScrollTop((current) => {
        const next = Math.max(0, Math.floor(top / lineHeight) - OVERSCAN);
        const previous = Math.max(0, Math.floor(current / lineHeight) - OVERSCAN);
        return next === previous ? current : top;
      });
    },
    [virtual, lineHeight]
  );

  const digits = Math.max(String(lines.length).length, 3);

  const gutterWidth = `${digits}ch`;

  const widest = useMemo(() => {
    if (wrap) return 0;
    if (widestProp !== undefined) return widestProp;
    let max = 0;
    for (const line of lines) {
      const length = line.text?.length ?? 0;
      if (length > max) max = length;
    }
    return max;
  }, [lines, wrap, widestProp]);

  const renderRow = (line: CodeLine, index: number) => (
    <div
      key={index}
      className={cn(
        "amare-code-line",
        line.tone === "add" && "amare-line-add",
        line.tone === "del" && "amare-line-del",
        line.tone === "skip" && "amare-line-skip"
      )}
    >
      <span
        className="amare-code-gutter py-0 ps-2 pe-2"
        style={{ width: gutterWidth, minWidth: "2.25rem" }}
        aria-hidden="true"
      >
        <span className="amare-code-marker">{line.marker ?? ""}</span>
        {line.number ?? ""}
      </span>
      {line.html !== undefined ? (
        <span
          className="amare-code-text px-3"
          dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }}
        />
      ) : (
        <span className="amare-code-text px-3">{line.text || "\u00a0"}</span>
      )}
    </div>
  );

  const slice = virtual ? lines.slice(start, end) : lines;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cn("amare-code", wrap && "amare-code-wrap", "amare-code-scroll", className)}
      style={{ fontSize, lineHeight: `${lineHeight}px` }}
    >
      <div
        className="w-max min-w-full font-mono"
        style={{
          minWidth: wrap
            ? undefined
            : `calc(${gutterWidth} + ${widest * GLYPH_EM}em + 2rem)`,
        }}
      >
        {virtual && start > 0 ? (
          <div style={{ height: start * lineHeight }} aria-hidden="true" />
        ) : null}
        {slice.map((line, offset) => renderRow(line, virtual ? start + offset : offset))}
        {virtual && end < lines.length ? (
          <div style={{ height: (lines.length - end) * lineHeight }} aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
}

/** Splits raw source into plain (unhighlighted) renderable lines. */
export function plainLines(code: string, startNumber = 1): CodeLine[] {
  return code.split("\n").map((text, index) => ({ number: startNumber + index, text }));
}

/** Length of the longest line, used to size the horizontal scroll surface. */
export function widestLine(code: string): number {
  let max = 0;
  let current = 0;
  for (let index = 0; index < code.length; index += 1) {
    if (code.charCodeAt(index) === 10) {
      if (current > max) max = current;
      current = 0;
    } else {
      current += 1;
    }
  }
  return current > max ? current : max;
}
