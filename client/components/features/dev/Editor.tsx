"use client";

import { useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/cn";
import { countLines } from "@/lib/highlight";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  fontSize: number;
  lineHeight: number;
  className?: string;
  label?: string;
  readOnly?: boolean;
  onSave?: () => void;
}

/** Indent inserted by the Tab key, in spaces. */
const INDENT = "  ";

/**
 * Plain-text code editor: a textarea with wrap off and a line-number gutter
 * whose scroll is mirrored from the textarea.
 *
 * The gutter is a sibling rather than an overlay, so nothing has to line up
 * pixel-for-pixel and the caret can never drift away from its number.
 */
export function Editor({
  value,
  onChange,
  fontSize,
  lineHeight,
  className,
  label,
  readOnly,
  onSave,
}: EditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);

  const numbers = useMemo(() => {
    const count = countLines(value);
    let out = "";
    for (let index = 1; index <= count; index += 1) {
      out += index === 1 ? "1" : `\n${index}`;
    }
    return out;
  }, [value]);

  const digits = Math.max(String(countLines(value)).length, 3);

  const syncScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
    const gutter = gutterRef.current;
    if (gutter) gutter.scrollTop = event.currentTarget.scrollTop;
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave?.();
        return;
      }

      if (event.key !== "Tab" || event.shiftKey || readOnly) return;

      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = `${target.value.slice(0, start)}${INDENT}${target.value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        target.selectionStart = start + INDENT.length;
        target.selectionEnd = start + INDENT.length;
      });
    },
    [onChange, onSave, readOnly]
  );

  return (
    <div
      className={cn("amare-code flex", className)}
      style={{ fontSize, lineHeight: `${lineHeight}px` }}
    >
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="amare-code-gutter overflow-hidden"
        style={{ width: `${digits}ch`, minWidth: "2.25rem" }}
      >
        <pre className="m-0 ps-2 pe-2 font-mono">{numbers}</pre>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        wrap="off"
        aria-label={label}
        className="amare-editor min-w-0 flex-1 px-3 font-mono"
      />
    </div>
  );
}
