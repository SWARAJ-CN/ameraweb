"use client";

import { useMemo } from "react";
import { CodeLines, plainLines, widestLine, type CodeLine } from "./CodeLines";
import { useHighlightedLines } from "./use-highlighted-lines";

interface CodeViewProps {
  code: string;
  /** Repository path — drives language detection. */
  path: string;
  wrap: boolean;
  fontSize: number;
  lineHeight: number;
  className?: string;
  label?: string;
}

/**
 * Read-only source view with syntax highlighting and a line-number gutter.
 *
 * Plain text renders immediately and is swapped for the highlighted version
 * once highlight.js resolves, so opening a file never shows an empty pane.
 */
export function CodeView({
  code,
  path,
  wrap,
  fontSize,
  lineHeight,
  className,
  label,
}: CodeViewProps) {
  const { htmlLines } = useHighlightedLines(code, path);

  const lines = useMemo<CodeLine[]>(() => {
    if (htmlLines) {
      return htmlLines.map((html, index) => ({ number: index + 1, html }));
    }
    return plainLines(code);
  }, [code, htmlLines]);

  const widest = useMemo(() => widestLine(code), [code]);

  return (
    <CodeLines
      lines={lines}
      widest={widest}
      fontSize={fontSize}
      lineHeight={lineHeight}
      wrap={wrap}
      className={className}
      label={label}
    />
  );
}
