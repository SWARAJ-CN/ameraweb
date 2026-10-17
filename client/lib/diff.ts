/**
 * Line diffing for the Developer Mode review pane.
 *
 * Small and dependency-free: it trims the common prefix/suffix first (which
 * collapses the usual "changed one function" case down to a few lines) and
 * only then runs an LCS table over what is left. Past a cell budget the middle
 * is reported as a straight replacement instead of allocating a huge table —
 * the diff is a review aid, not a merge tool.
 */

export type DiffKind = "same" | "add" | "del";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** 1-based line number in the original file, or null for added lines. */
  oldNumber: number | null;
  /** 1-based line number in the draft, or null for removed lines. */
  newNumber: number | null;
}

export interface DiffStats {
  added: number;
  removed: number;
}

const MAX_CELLS = 4_000_000;

interface Op {
  kind: DiffKind;
  text: string;
}

function middle(a: string[], b: string[]): Op[] {
  const rows = a.length;
  const columns = b.length;

  if (rows * columns > MAX_CELLS) {
    return [
      ...a.map<Op>((text) => ({ kind: "del", text })),
      ...b.map<Op>((text) => ({ kind: "add", text })),
    ];
  }

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const width = columns + 1;
  const lcs = new Uint32Array((rows + 1) * width);

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;

  while (i < rows && j < columns) {
    if (a[i] === b[j]) {
      ops.push({ kind: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      ops.push({ kind: "del", text: a[i] });
      i += 1;
    } else {
      ops.push({ kind: "add", text: b[j] });
      j += 1;
    }
  }

  while (i < rows) {
    ops.push({ kind: "del", text: a[i] });
    i += 1;
  }
  while (j < columns) {
    ops.push({ kind: "add", text: b[j] });
    j += 1;
  }

  return ops;
}

/** Diffs two files line by line, with line numbers on both sides. */
export function diffLines(before: string, after: string): DiffLine[] {
  if (before === after) return [];

  const a = before.split("\n");
  const b = after.split("\n");

  let start = 0;
  const shortest = Math.min(a.length, b.length);
  while (start < shortest && a[start] === b[start]) start += 1;

  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA -= 1;
    endB -= 1;
  }

  const lines: DiffLine[] = [];
  let oldNumber = 1;
  let newNumber = 1;

  const same = (text: string) => {
    lines.push({ kind: "same", text, oldNumber, newNumber });
    oldNumber += 1;
    newNumber += 1;
  };
  const removed = (text: string) => {
    lines.push({ kind: "del", text, oldNumber, newNumber: null });
    oldNumber += 1;
  };
  const added = (text: string) => {
    lines.push({ kind: "add", text, oldNumber: null, newNumber });
    newNumber += 1;
  };

  for (let index = 0; index < start; index += 1) same(a[index]);

  for (const op of middle(a.slice(start, endA + 1), b.slice(start, endB + 1))) {
    if (op.kind === "same") same(op.text);
    else if (op.kind === "del") removed(op.text);
    else added(op.text);
  }

  for (let index = endA + 1; index < a.length; index += 1) same(a[index]);

  return lines;
}

export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === "add") added += 1;
    else if (line.kind === "del") removed += 1;
  }
  return { added, removed };
}

/**
 * Collapses a diff down to the changed hunks plus `context` lines around them,
 * the way a unified diff reads. Keeps the review pane short on big files.
 */
export function collapseDiff(lines: DiffLine[], context = 3): DiffLine[] {
  if (!lines.length) return [];

  const keep = new Uint8Array(lines.length);
  lines.forEach((line, index) => {
    if (line.kind === "same") return;
    const from = Math.max(0, index - context);
    const to = Math.min(lines.length - 1, index + context);
    for (let cursor = from; cursor <= to; cursor += 1) keep[cursor] = 1;
  });

  const out: DiffLine[] = [];
  let skipped = 0;

  const flush = () => {
    if (skipped > 0) {
      out.push({
        kind: "same",
        text: `⋯ ${skipped} unchanged line${skipped === 1 ? "" : "s"}`,
        oldNumber: null,
        newNumber: null,
      });
      skipped = 0;
    }
  };

  lines.forEach((line, index) => {
    if (keep[index]) {
      flush();
      out.push(line);
    } else {
      skipped += 1;
    }
  });
  flush();

  return out;
}
