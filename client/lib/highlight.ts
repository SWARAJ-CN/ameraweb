/**
 * Syntax highlighting for Developer Mode.
 *
 * highlight.js is loaded lazily: the grammar bundle is the single heaviest
 * thing in the dev panel, so it is only fetched the first time somebody
 * actually opens a file. Nothing here runs during the initial page load.
 *
 * Highlighting happens before rendering, and the resulting HTML is split into
 * one string per source line so the viewer can put a line-number gutter beside
 * every line without a table or a second scroll container.
 */

import type { HLJSApi, LanguageFn } from "highlight.js";

export interface LanguageInfo {
  /** highlight.js language id. */
  id: string;
  /** Human label shown in the file header. */
  label: string;
}

function language(id: string, label: string): LanguageInfo {
  return { id, label };
}

/* ------------------------------------------------------------------ *
 * Path → language
 * ------------------------------------------------------------------ */

const BY_EXTENSION: Record<string, LanguageInfo> = {
  js: language("javascript", "JavaScript"),
  mjs: language("javascript", "JavaScript"),
  cjs: language("javascript", "JavaScript"),
  jsx: language("javascript", "JSX"),
  ts: language("typescript", "TypeScript"),
  mts: language("typescript", "TypeScript"),
  cts: language("typescript", "TypeScript"),
  tsx: language("typescript", "TSX"),
  json: language("json", "JSON"),
  jsonc: language("json", "JSON"),
  json5: language("json", "JSON5"),
  html: language("xml", "HTML"),
  htm: language("xml", "HTML"),
  xml: language("xml", "XML"),
  svg: language("xml", "SVG"),
  vue: language("xml", "Vue"),
  css: language("css", "CSS"),
  scss: language("scss", "SCSS"),
  less: language("less", "Less"),
  md: language("markdown", "Markdown"),
  markdown: language("markdown", "Markdown"),
  mdx: language("markdown", "MDX"),
  yml: language("yaml", "YAML"),
  yaml: language("yaml", "YAML"),
  sh: language("bash", "Shell"),
  bash: language("bash", "Bash"),
  zsh: language("bash", "Zsh"),
  py: language("python", "Python"),
  sql: language("sql", "SQL"),
  diff: language("diff", "Diff"),
  patch: language("diff", "Patch"),
  ini: language("ini", "INI"),
  cfg: language("ini", "Config"),
  conf: language("ini", "Config"),
  env: language("ini", "Environment"),
  toml: language("ini", "TOML"),
  properties: language("properties", "Properties"),
  graphql: language("graphql", "GraphQL"),
  gql: language("graphql", "GraphQL"),
  go: language("go", "Go"),
  rs: language("rust", "Rust"),
  java: language("java", "Java"),
  kt: language("kotlin", "Kotlin"),
  kts: language("kotlin", "Kotlin"),
  swift: language("swift", "Swift"),
  c: language("c", "C"),
  h: language("c", "C header"),
  cpp: language("cpp", "C++"),
  cc: language("cpp", "C++"),
  cxx: language("cpp", "C++"),
  hpp: language("cpp", "C++ header"),
  cs: language("csharp", "C#"),
  php: language("php", "PHP"),
  rb: language("ruby", "Ruby"),
  lua: language("lua", "Lua"),
  mk: language("makefile", "Makefile"),
  txt: language("plaintext", "Text"),
  log: language("plaintext", "Log"),
};

const BY_FILENAME: Record<string, LanguageInfo> = {
  dockerfile: language("dockerfile", "Dockerfile"),
  "docker-compose.yml": language("yaml", "Docker Compose"),
  "docker-compose.yaml": language("yaml", "Docker Compose"),
  makefile: language("makefile", "Makefile"),
  "nginx.conf": language("nginx", "nginx"),
  "package-lock.json": language("json", "Lock file"),
  "pnpm-lock.yaml": language("yaml", "Lock file"),
  "yarn.lock": language("plaintext", "Lock file"),
  ".gitignore": language("plaintext", "Ignore rules"),
  ".dockerignore": language("plaintext", "Ignore rules"),
  ".env": language("ini", "Environment"),
  ".env.local": language("ini", "Environment"),
  ".env.example": language("ini", "Environment"),
  ".npmrc": language("ini", "Config"),
  ".editorconfig": language("ini", "Config"),
  "tsconfig.json": language("json", "TS config"),
};

/** Resolves a repository path to the language highlight.js should use. */
export function detectLanguage(path: string): LanguageInfo | null {
  const name = path.split("/").pop() ?? "";
  const lower = name.toLowerCase();

  const byName = BY_FILENAME[lower] ?? BY_FILENAME[name];
  if (byName) return byName;

  if (lower.startsWith(".env")) return language("ini", "Environment");

  const dot = lower.lastIndexOf(".");
  if (dot <= 0) return null;
  return BY_EXTENSION[lower.slice(dot + 1)] ?? null;
}

/** Longest path segment-safe file extension, used for quick-open filtering. */
export function fileExtension(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/* ------------------------------------------------------------------ *
 * Lazy highlight.js engine
 * ------------------------------------------------------------------ */

/* Registered explicitly so the bundler can see exactly which grammars to
   include — a computed import would drag in all ~190 of them. */
const IMPORTERS: Record<string, () => Promise<{ default: LanguageFn }>> = {
  javascript: () => import("highlight.js/lib/languages/javascript"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  json: () => import("highlight.js/lib/languages/json"),
  xml: () => import("highlight.js/lib/languages/xml"),
  css: () => import("highlight.js/lib/languages/css"),
  scss: () => import("highlight.js/lib/languages/scss"),
  less: () => import("highlight.js/lib/languages/less"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
  bash: () => import("highlight.js/lib/languages/bash"),
  python: () => import("highlight.js/lib/languages/python"),
  sql: () => import("highlight.js/lib/languages/sql"),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
  ini: () => import("highlight.js/lib/languages/ini"),
  properties: () => import("highlight.js/lib/languages/properties"),
  diff: () => import("highlight.js/lib/languages/diff"),
  graphql: () => import("highlight.js/lib/languages/graphql"),
  go: () => import("highlight.js/lib/languages/go"),
  rust: () => import("highlight.js/lib/languages/rust"),
  java: () => import("highlight.js/lib/languages/java"),
  kotlin: () => import("highlight.js/lib/languages/kotlin"),
  swift: () => import("highlight.js/lib/languages/swift"),
  c: () => import("highlight.js/lib/languages/c"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  php: () => import("highlight.js/lib/languages/php"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  lua: () => import("highlight.js/lib/languages/lua"),
  makefile: () => import("highlight.js/lib/languages/makefile"),
  nginx: () => import("highlight.js/lib/languages/nginx"),
  plaintext: () => import("highlight.js/lib/languages/plaintext"),
};

let engine: Promise<HLJSApi> | null = null;

function loadEngine(): Promise<HLJSApi> {
  if (!engine) {
    engine = (async () => {
      const [core, modules] = await Promise.all([
        import("highlight.js/lib/core"),
        Promise.all(Object.values(IMPORTERS).map((load) => load())),
      ]);
      const hljs = core.default;
      Object.keys(IMPORTERS).forEach((name, index) => {
        hljs.registerLanguage(name, modules[index].default);
      });
      return hljs;
    })();
  }
  return engine;
}

/** Highlighting more than this many lines is not worth the main-thread cost. */
export const MAX_HIGHLIGHT_LINES = 4000;

export interface HighlightResult {
  /** Highlighted HTML, or `null` when the language is unknown/too big. */
  html: string | null;
  language: LanguageInfo | null;
}

/**
 * Highlights a whole file. Never throws — an unknown language, an enormous
 * file or a grammar crash all degrade to plain text.
 */
export async function highlightCode(
  code: string,
  path: string
): Promise<HighlightResult> {
  const info = detectLanguage(path);
  if (!info) return { html: null, language: null };

  if (code.length > 200_000 || countLines(code) > MAX_HIGHLIGHT_LINES) {
    return { html: null, language: info };
  }

  try {
    const hljs = await loadEngine();
    if (!hljs.getLanguage(info.id)) return { html: null, language: info };
    return {
      html: hljs.highlight(code, { language: info.id, ignoreIllegals: true }).value,
      language: info,
    };
  } catch {
    return { html: null, language: info };
  }
}

export function countLines(text: string): number {
  if (!text) return 0;
  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) lines += 1;
  }
  return lines;
}

/* ------------------------------------------------------------------ *
 * Highlighted HTML → one string per line
 * ------------------------------------------------------------------ */

/**
 * Splits highlighted HTML on newlines while keeping every `<span>` balanced.
 *
 * highlight.js emits spans that straddle newlines (block comments, template
 * literals, multi-line strings). A naive `split("\n")` would leave those tags
 * open at the end of one line and the rest of the document would inherit the
 * wrong colour, so each line re-opens the spans it inherited and closes them
 * again at the end.
 */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let current = "";
  let index = 0;

  const closeAll = () => {
    for (let depth = open.length - 1; depth >= 0; depth -= 1) current += "</span>";
  };

  while (index < html.length) {
    const char = html[index];

    if (char === "<") {
      const end = html.indexOf(">", index);
      if (end === -1) {
        current += html.slice(index);
        break;
      }
      const tag = html.slice(index, end + 1);
      if (tag.startsWith("</")) open.pop();
      else if (!tag.endsWith("/>")) open.push(tag);
      current += tag;
      index = end + 1;
      continue;
    }

    if (char === "\n") {
      closeAll();
      lines.push(current);
      current = open.join("");
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  closeAll();
  lines.push(current);
  return lines;
}
