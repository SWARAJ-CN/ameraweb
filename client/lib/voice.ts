import { NAV_ITEMS } from "@/components/layout/nav-config";

/**
 * Voice command grammar.
 *
 * Speech recognition gives us loose text — "go to the sales page", "sales",
 * "show me products" — so matching is deliberately forgiving but must not fire
 * on ordinary conversation. A phrase only counts when it is either
 *
 *   1. opened with a verb ("go to…", "open…", "show me…"), where the page name
 *      may sit anywhere in the sentence, or
 *   2. the whole utterance, once filler words are dropped ("the sales page",
 *      "products please").
 *
 * Within that rule the match is scored rather than filtered, so a mis-heard
 * spelling still lands on the right page: an exact hit scores 1, and a near
 * miss scores by how far off it was. Callers act on a high score and offer the
 * rest as suggestions.
 */

export type VoiceThemeMode = "light" | "dark" | "system";

export type VoiceAction =
  | { kind: "navigate"; href: string; label: string }
  | { kind: "theme"; mode: VoiceThemeMode; label: string }
  | { kind: "refresh"; label: string }
  | { kind: "stop"; label: string };

interface VoiceCandidate {
  /** Word sequence that triggers the command, lowercase and punctuation-free. */
  phrase: string[];
  action: VoiceAction;
}

/** Extra names people actually say, on top of each page's own label. */
const NAV_ALIASES: Record<string, string[]> = {
  "/": ["home", "overview", "main", "start", "homepage", "summary"],
  "/reports": ["report", "analytics", "analysis", "trends", "charts", "stats", "statistics"],
  "/sales": [
    "sale",
    "sails",
    "sells",
    "bills",
    "bill",
    "orders",
    "order",
    "invoices",
    "invoice",
    "custom orders",
  ],
  "/expenses": ["expense", "spending", "costs", "purchases"],
  "/products": ["product", "items", "catalogue", "stock", "inventory"],
  "/calculations": ["calculations", "calculation", "pricing", "quotes"],
  "/database": ["db", "data", "collections", "records"],
  "/server": ["backend", "status", "endpoints", "uptime", "server status"],
  "/settings": ["setting", "preferences", "profile", "invoice settings"],
  "/developer": ["dev", "code", "codebase", "git", "repo", "repository"],
};

/**
 * Words that carry no meaning on their own. Dropping them lets "the sales
 * page" count as the whole utterance while "what is the status" still does not.
 */
const FILLER = new Set([
  "a",
  "an",
  "the",
  "please",
  "page",
  "pages",
  "tab",
  "tabs",
  "section",
  "sections",
  "panel",
  "screen",
  "my",
  "our",
  "to",
  "for",
  "me",
  "now",
]);

/** Verbs that may introduce a command, making the page name free to float. */
const OPENERS = new Set([
  "go",
  "goto",
  "open",
  "show",
  "switch",
  "navigate",
  "display",
  "view",
  "see",
  "take",
  "bring",
  "pull",
  "jump",
  "find",
  "let",
  "lets",
]);

const THEME_PHRASES: Array<{ mode: VoiceThemeMode; phrases: string[]; label: string }> = [
  {
    mode: "dark",
    label: "Dark theme",
    phrases: ["dark mode", "dark theme", "night mode", "dark", "make it dark"],
  },
  {
    mode: "light",
    label: "Light theme",
    phrases: ["light mode", "light theme", "day mode", "light", "make it light"],
  },
  {
    mode: "system",
    label: "System theme",
    phrases: ["system mode", "system theme", "automatic theme", "follow the system"],
  },
];

const EXTRA_PHRASES: Array<{ phrases: string[]; action: VoiceAction }> = [
  {
    phrases: ["refresh", "refresh data", "reload", "sync", "sync now"],
    action: { kind: "refresh", label: "Refresh" },
  },
  {
    phrases: ["stop listening", "stop", "cancel", "never mind", "nevermind", "that is all"],
    action: { kind: "stop", label: "Stop listening" },
  },
];

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

const CANDIDATES: VoiceCandidate[] = [
  ...NAV_ITEMS.flatMap((item) =>
    unique([item.label, ...(NAV_ALIASES[item.href] ?? [])]).map((phrase) => ({
      phrase: words(phrase),
      action: { kind: "navigate", href: item.href, label: item.label } as VoiceAction,
    }))
  ),
  ...THEME_PHRASES.flatMap((theme) =>
    theme.phrases.map((phrase) => ({
      phrase: words(phrase),
      action: { kind: "theme", mode: theme.mode, label: theme.label } as VoiceAction,
    }))
  ),
  ...EXTRA_PHRASES.flatMap((entry) =>
    entry.phrases.map((phrase) => ({ phrase: words(phrase), action: entry.action }))
  ),
].filter((candidate) => candidate.phrase.length > 0);

/** Where `phrase` first appears as a run of whole words, or -1. */
function indexOfSequence(haystack: string[], needle: string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let matched = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

/** Plain Levenshtein distance. Words are short, so the simple table is fine. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

export interface VoiceMatch {
  action: VoiceAction;
  /** 0–1. 1 means a label or alias was heard exactly. */
  score: number;
  /** The word or words that triggered it. */
  phrase: string;
  /** True when nothing had to be guessed. */
  exact: boolean;
}

/** At or above this the command is acted on; below it we ask first. */
export const AUTO_RUN_SCORE = 0.8;
/** Below this a candidate is not worth showing at all. */
const SUGGEST_SCORE = 0.55;

/**
 * How far apart two words may be and still count as the same word.
 *
 * Proportional distance is the wrong yardstick here: "stop" and "stock" are 60%
 * alike yet mean nothing to each other, while "expen" and "expenses" are only
 * 75% alike and plainly the same word. So the budget scales with length, and
 * short words — where a single stray letter changes everything — get almost
 * none.
 */
function allowWithin(a: string, b: string): number {
  if (Math.min(a.length, b.length) <= 4) return 1;
  return Math.max(a.length, b.length) <= 8 ? 2 : 3;
}

/**
 * How close an utterance is to `phrase`.
 *
 * `anywhere` is true when the sentence opens with a verb, which lets the phrase
 * sit anywhere in it. Without that, the utterance has to be the phrase and
 * nothing else — otherwise "what is the status" would match Server, and every
 * stray word would switch pages.
 */
function fuzzyScore(phrase: string[], words: string[], anywhere: boolean): number {
  if (words.length === 0 || phrase.length === 0) return 0;

  if (!anywhere && words.length !== phrase.length) return 0;

  let best = 0;
  const last = anywhere ? words.length - phrase.length : 0;
  for (let i = 0; i <= last; i += 1) {
    let distance = 0;
    let longest = 0;
    let withinBudget = true;
    for (let j = 0; j < phrase.length; j += 1) {
      const heard = words[i + j];
      const wanted = phrase[j];
      const gap = editDistance(heard, wanted);
      if (gap > allowWithin(heard, wanted)) {
        withinBudget = false;
        break;
      }
      distance += gap;
      longest += Math.max(heard.length, wanted.length);
    }
    if (withinBudget && longest > 0) best = Math.max(best, 1 - distance / longest);
  }
  // Rounded so a near-miss lands on the same value the panel prints, and so the
  // auto-run cut-off is not a coin toss on floating-point noise.
  return Math.round(best * 1000) / 1000;
}

function scoreCandidate(
  candidate: VoiceCandidate,
  heard: string[],
  bare: string[],
  opens: boolean
): { score: number; exact: boolean } | null {
  if (indexOfSequence(heard, candidate.phrase) !== -1) {
    const wholeUtterance =
      bare.length === candidate.phrase.length &&
      candidate.phrase.every((word, index) => bare[index] === word);
    if (wholeUtterance || opens) return { score: 1, exact: true };
  }

  const fuzzy = fuzzyScore(candidate.phrase, opens ? heard : bare, opens);
  return fuzzy > 0 ? { score: fuzzy, exact: false } : null;
}

function actionKey(action: VoiceAction): string {
  if (action.kind === "navigate") return `nav:${action.href}`;
  if (action.kind === "theme") return `theme:${action.mode}`;
  return action.kind;
}

/**
 * Every command the utterance could plausibly mean, best first.
 *
 * Speech recognition is approximate, so this scores rather than filters: a hit
 * on a label or alias is 1, a near-miss on the spelling scores lower, and the
 * caller decides whether the result is good enough to act on unasked.
 */
export function suggestVoiceCommands(transcript: string, limit = 4): VoiceMatch[] {
  const heard = words(transcript);
  if (heard.length === 0) return [];

  const bare = heard.filter((word) => !FILLER.has(word));
  const opens = OPENERS.has(heard[0]);

  const best = new Map<string, VoiceMatch>();
  for (const candidate of CANDIDATES) {
    const outcome = scoreCandidate(candidate, heard, bare, opens);
    if (!outcome || outcome.score < SUGGEST_SCORE) continue;

    const key = actionKey(candidate.action);
    const match: VoiceMatch = {
      action: candidate.action,
      score: outcome.score,
      phrase: candidate.phrase.join(" "),
      exact: outcome.exact,
    };
    const current = best.get(key);
    if (!current || match.score > current.score) best.set(key, match);
  }

  return [...best.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        // Same confidence: the shorter, more specific phrase wins, then
        // alphabetical order keeps the list stable between runs.
        a.phrase.length - b.phrase.length ||
        a.phrase.localeCompare(b.phrase)
    )
    .slice(0, limit);
}

/** The best command across several readings of the same utterance. */
export function bestVoiceMatch(transcripts: string[], limit = 4): VoiceMatch[] {
  const best = new Map<string, VoiceMatch>();
  for (const transcript of transcripts) {
    for (const match of suggestVoiceCommands(transcript, limit)) {
      const key = actionKey(match.action);
      const current = best.get(key);
      if (!current || match.score > current.score) best.set(key, match);
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ------------------------------------------------------------------ speech */

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

/**
 * The subset of the Web Speech API this app uses. Declared here rather than
 * relying on `lib.dom`, which does not carry these across every TypeScript
 * version, and because Chrome still ships them prefixed.
 */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** Chrome and Edge expose this; Firefox and Safari do not (as of writing). */
export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/* ---------------------------------------------------------------- language */

export interface VoiceLanguage {
  value: string;
  label: string;
}

/**
 * The accent the recogniser should expect. This is the single biggest accuracy
 * lever: Chrome picks its acoustic model from this tag, so an Indian-English
 * speaker gets noticeably better results from `en-IN` than the browser's
 * default `en-US`.
 */
export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { value: "en-IN", label: "English (India)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "ta-IN", label: "Tamil" },
];

/** The shop is Indian, so Indian English is the sensible starting point. */
export const DEFAULT_VOICE_LANGUAGE = "en-IN";

/**
 * The language the assistant listens and speaks in — the language the reader
 * picked, or the app's own language when they chose to follow it.
 */
export function voiceLocale(language: string, appLocale: string): string {
  const candidate = language.trim() || appLocale.trim();
  return candidate || DEFAULT_VOICE_LANGUAGE;
}

/**
 * The BCP-47 accent for the recogniser and the speaking voice. An unpicked
 * language falls back to the accent the app's own locale points at.
 */
export function voiceAccent(language: string, speechAccent: string): string {
  const candidate = language.trim() || speechAccent.trim();
  return candidate || DEFAULT_VOICE_LANGUAGE;
}

const LANGUAGE_KEY = "amare.voice.language";
const LANGUAGE_EVENT = "amare:voice-language";

export function readVoiceLanguage(): string {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    // "" means "follow the app's language", so it is a valid pick too.
    if (stored !== null && (stored === "" || VOICE_LANGUAGES.some((entry) => entry.value === stored))) {
      return stored;
    }
  } catch {
    /* storage can be unavailable in private mode */
  }
  return DEFAULT_VOICE_LANGUAGE;
}

export function readVoiceLanguageOnServer(): string {
  return DEFAULT_VOICE_LANGUAGE;
}

export function setVoiceLanguage(value: string): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

export function subscribeVoiceLanguage(onChange: () => void): () => void {
  window.addEventListener(LANGUAGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
