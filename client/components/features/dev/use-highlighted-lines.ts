"use client";

import { useEffect, useState } from "react";
import {
  detectLanguage,
  highlightCode,
  splitHighlightedLines,
  type LanguageInfo,
} from "@/lib/highlight";

interface HighlightState {
  key: string;
  lines: string[] | null;
  language: LanguageInfo | null;
}

export interface HighlightedCode {
  /** One highlighted HTML string per source line, or null while pending. */
  htmlLines: string[] | null;
  /** Detected language — available immediately, before highlighting finishes. */
  language: LanguageInfo | null;
  pending: boolean;
}

/**
 * Highlights a file on the client without blocking paint.
 *
 * The result is tagged with the exact input it was produced from, so a stale
 * result from a previously opened file is ignored during render instead of
 * being cleared in an effect.
 */
export function useHighlightedLines(code: string, path: string): HighlightedCode {
  const key = `${path}\u0000${code}`;
  const [state, setState] = useState<HighlightState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void highlightCode(code, path).then((result) => {
      if (cancelled) return;
      setState({
        key,
        lines: result.html === null ? null : splitHighlightedLines(result.html),
        language: result.language,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [code, key, path]);

  const current = state && state.key === key ? state : null;

  return {
    htmlLines: current?.lines ?? null,
    language: current?.language ?? detectLanguage(path),
    pending: current === null,
  };
}
