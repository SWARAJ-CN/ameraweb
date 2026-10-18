"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Info, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { useData } from "@/components/providers/DataProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/cn";
import {
  AUTO_RUN_SCORE,
  bestVoiceMatch,
  getSpeechRecognition,
  readVoiceLanguage,
  readVoiceLanguageOnServer,
  setVoiceLanguage,
  subscribeVoiceLanguage,
  VOICE_LANGUAGES,
  type SpeechRecognitionLike,
  type VoiceAction,
} from "@/lib/voice";
import { NAV_ITEMS } from "./nav-config";
import { VoiceMeter } from "./VoiceMeter";

type Tone = "success" | "info" | "warning" | "danger";

interface Notice {
  tone: Tone;
  text: string;
}

const TONES: Record<Tone, { className: string; icon: typeof Check }> = {
  success: { className: "text-success", icon: Check },
  info: { className: "text-muted-foreground", icon: Info },
  warning: { className: "text-warning", icon: AlertTriangle },
  danger: { className: "text-danger", icon: AlertTriangle },
};

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "Microphone blocked. Allow it in your browser settings, then try again.",
  "service-not-allowed": "The browser refused speech recognition on this connection.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs a working connection to the browser's speech service.",
  "language-not-supported": "This browser has no speech model for that language.",
};

const UNSUPPORTED_TEXT =
  "Voice commands need Chrome or Edge — this browser has no speech recognition.";

/** How many readings of one utterance to ask the recogniser for. */
const MAX_ALTERNATIVES = 5;

/* Browser support never changes while the page is open, so the store is inert:
   this only lets React tell the server render (no `window`) from the client one
   without a state write inside an effect. */
const subscribeToNothing = () => () => {};
const canListen = () => getSpeechRecognition() !== null;
const cannotListen = () => false;

/**
 * Microphone control in the topbar: say a page name and the sidebar switches to
 * it.
 *
 * Opening it shows a live preview of the capture — a level meter and the words
 * as they arrive — plus what the current words would do if they stopped now.
 * Recognition is approximate, so the preview also offers the runner-up pages
 * and the recogniser's other readings as one-tap corrections.
 *
 * Listening is always opt-in: the button turns it on and off, and the pulse
 * ring plus the meter make it obvious when the microphone is live.
 */
export function VoiceCommand() {
  const router = useRouter();
  const pathname = usePathname();
  const { refresh } = useData();
  const { setMode } = useTheme();

  const supported = useSyncExternalStore(subscribeToNothing, canListen, cannotListen);
  const language = useSyncExternalStore(
    subscribeVoiceLanguage,
    readVoiceLanguage,
    readVoiceLanguageOnServer
  );

  const [listening, setListening] = useState(false);
  const [open, setOpen] = useState(false);
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState("");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /** Whether the user still wants the microphone on; drives auto-restart. */
  const wantRef = useRef(false);

  const safeStart = useCallback(() => {
    try {
      recognitionRef.current?.start();
    } catch {
      /* already running — Chrome throws rather than ignoring a second start */
    }
  }, []);

  /* Build the recogniser once. */
  useEffect(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = MAX_ALTERNATIVES;
    recognitionRef.current = recognition;

    return () => {
      wantRef.current = false;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.abort();
      } catch {
        /* nothing to stop */
      }
      recognitionRef.current = null;
    };
  }, []);

  /* Chrome only reads `lang` when a session starts, so restart on a change. */
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.lang = language;
    if (!wantRef.current) return;
    try {
      recognition.stop();
    } catch {
      /* not running */
    }
  }, [language]);

  const stopListening = useCallback(() => {
    wantRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* not running */
    }
    setListening(false);
    setInterim("");
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    wantRef.current = true;
    setNotice(null);
    setHeard("");
    setInterim("");
    setAlternatives([]);
    setListening(true);
    setOpen(true);
    safeStart();
  }, [safeStart]);

  /* What to do with a chosen command. Kept current via a ref so the
     recogniser's callbacks, bound once, always see this render's values. */
  const run = useCallback(
    (action: VoiceAction) => {
      if (action.kind === "navigate") {
        if (action.href === pathname) {
          setNotice({ tone: "info", text: `Already on ${action.label}` });
          return;
        }
        router.push(action.href);
        setNotice({ tone: "success", text: `Opened ${action.label}` });
        return;
      }
      if (action.kind === "theme") {
        setMode(action.mode);
        setNotice({ tone: "success", text: `${action.label} on` });
        return;
      }
      if (action.kind === "refresh") {
        void refresh({ silent: true });
        setNotice({ tone: "success", text: "Refreshing data" });
        return;
      }
      stopListening();
      setNotice({ tone: "info", text: "Voice input off" });
    },
    [pathname, refresh, router, setMode, stopListening]
  );

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  /* Bind the recogniser's events. */
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onstart = () => setListening(true);

    recognition.onend = () => {
      setInterim("");
      if (!wantRef.current) return;
      // Chrome closes the session after a pause; reopen it so the microphone
      // stays live until the user turns it off.
      window.setTimeout(() => {
        if (wantRef.current) safeStart();
      }, 250);
    };

    recognition.onerror = (event) => {
      const code = event.error;
      // Silence and our own aborts are not failures.
      if (code === "no-speech" || code === "aborted") return;
      wantRef.current = false;
      // The browser ends the session itself, but stopping makes sure the
      // microphone is released even if it does not.
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
      setListening(false);
      setInterim("");
      setNotice({
        tone: "danger",
        text: ERROR_TEXT[code] ?? `Voice input stopped (${code}).`,
      });
    };

    recognition.onresult = (event) => {
      // A final result can still land just after the user stops listening.
      if (!wantRef.current) return;

      let finalText = "";
      let interimText = "";
      let readings: string[] = [];

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0]?.transcript ?? "";
          // The recogniser's own runner-up readings, best first.
          const others: string[] = [];
          for (let a = 0; a < result.length; a += 1) {
            const text = result[a]?.transcript?.trim();
            if (text) others.push(text);
          }
          if (others.length) readings = others;
        } else {
          interimText += result[0]?.transcript ?? "";
        }
      }

      if (interimText.trim()) setInterim(interimText.trim());
      if (!finalText.trim()) return;

      setInterim("");
      setHeard(finalText.trim());
      setAlternatives(readings.filter((text) => text !== finalText.trim()).slice(0, 3));

      // Consider every reading: a garbled top guess is often spelled correctly
      // in one of the others.
      const matches = bestVoiceMatch([finalText.trim(), ...readings]);
      const top = matches[0];
      if (top && top.score >= AUTO_RUN_SCORE) {
        runRef.current(top.action);
      } else {
        setNotice({
          tone: top ? "warning" : "danger",
          text: top
            ? "Not sure about that one — pick the page you meant."
            : "That was not a command — try a page name.",
        });
      }
    };
  }, [safeStart]);

  /* Live preview: what the words so far would do if the speaker stopped now. */
  const previewText = interim || heard;
  const matches = useMemo(
    () => (previewText ? bestVoiceMatch([previewText, ...alternatives], 4) : []),
    [previewText, alternatives]
  );
  const top = matches[0];
  const rest = matches.slice(1);

  /* Once listening stops, hold the panel open just long enough to read the result. */
  useEffect(() => {
    if (listening || !open) return;
    const id = window.setTimeout(() => setOpen(false), notice ? 2600 : 500);
    return () => window.clearTimeout(id);
  }, [listening, open, notice]);

  /* Clicking away or pressing Escape puts the microphone back to sleep. */
  useEffect(() => {
    if (!open) return;

    const dismiss = () => {
      wantRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* not running */
      }
      setListening(false);
      setOpen(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (listening) {
      stopListening();
      return;
    }
    if (!supported) {
      // Nothing to start, but the reason should still be reachable.
      setNotice({ tone: "danger", text: UNSUPPORTED_TEXT });
      setOpen(true);
      return;
    }
    startListening();
  };

  const unavailable = !supported;
  const status = listening
    ? "Listening…"
    : unavailable
      ? "Not available here"
      : notice?.tone === "danger"
        ? "Voice input stopped"
        : "Voice input off";

  return (
    <div ref={wrapperRef} className="relative flex-none">
      {listening ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-accent/40"
        />
      ) : null}

      <Button
        size="icon"
        variant={listening ? "primary" : "secondary"}
        onClick={toggle}
        aria-pressed={listening}
        aria-label="Voice commands"
        title={
          unavailable
            ? "Voice commands need Chrome or Edge"
            : listening
              ? "Stop listening"
              : "Switch pages by voice"
        }
        className="relative"
      >
        {unavailable ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Voice commands"
          className="animate-rise absolute end-0 top-full z-50 mt-2 flex max-h-[75vh] w-[24rem] max-w-[calc(100vw_-_2.5rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-pop"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 flex-none rounded-full",
                listening ? "animate-pulse bg-accent" : "bg-muted-foreground"
              )}
            />
            <p className="text-sm font-semibold text-foreground">{status}</p>
            <button
              type="button"
              aria-label="Close the voice panel"
              onClick={() => (listening ? stopListening() : setOpen(false))}
              className="ms-auto -me-1 grid size-6 flex-none place-items-center rounded-md text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {listening ? (
            <VoiceMeter
              active
              className="h-10 w-full rounded-lg bg-surface-muted text-accent"
            />
          ) : null}

          <p
            aria-live="polite"
            className={cn(
              "min-h-12 text-lg leading-snug break-words",
              previewText ? "text-foreground" : "text-sm text-faint-foreground"
            )}
          >
            {previewText ? (
              <>
                {previewText}
                {interim ? (
                  <span className="ms-0.5 inline-block h-5 w-0.5 animate-pulse bg-accent align-middle" />
                ) : null}
              </>
            ) : listening ? (
              "Speak now — a page name, or “open settings”."
            ) : (
              "Say a page name, for example “sales”."
            )}
          </p>

          {top ? (
            <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
              <ArrowRight className="size-4 flex-none text-accent" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {top.action.label}
              </span>
              <span
                className={cn(
                  "flex-none text-[11px] font-semibold tabular-nums",
                  top.score >= AUTO_RUN_SCORE ? "text-success" : "text-warning"
                )}
                title={
                  top.score >= AUTO_RUN_SCORE
                    ? "Confident enough to act on its own"
                    : "Not confident — pick it to use it"
                }
              >
                {Math.round(top.score * 100)}%
              </span>
              <Button size="sm" variant="outline" onClick={() => run(top.action)}>
                Use
              </Button>
            </div>
          ) : previewText ? (
            <p className="text-xs font-medium text-warning">
              No command in that — try a page name.
            </p>
          ) : null}

          {rest.length ? (
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                {top && top.score >= AUTO_RUN_SCORE ? "Or maybe" : "Did you mean"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {rest.map((match) => (
                  <button
                    key={`${match.action.kind}:${match.action.label}`}
                    type="button"
                    onClick={() => run(match.action)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground"
                  >
                    {match.action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {alternatives.length ? (
            <p className="text-[11px] text-faint-foreground">
              Also heard: {alternatives.map((text) => `“${text}”`).join(", ")}
            </p>
          ) : null}

          {notice ? (
            <p
              className={cn(
                "flex items-start gap-1.5 text-xs font-medium",
                TONES[notice.tone].className
              )}
            >
              {(() => {
                const Icon = TONES[notice.tone].icon;
                return <Icon className="mt-px size-3.5 flex-none" />;
              })()}
              <span className="min-w-0">{notice.text}</span>
            </p>
          ) : null}

          <div className="border-t border-separator pt-3">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              Try saying
            </p>
            <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.href} className="truncate text-xs text-muted-foreground">
                  {item.label}
                </li>
              ))}
              <li className="truncate text-xs text-muted-foreground">&ldquo;dark mode&rdquo;</li>
              <li className="truncate text-xs text-muted-foreground">&ldquo;refresh data&rdquo;</li>
            </ul>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-[11px] font-semibold tracking-wide text-muted uppercase"
              htmlFor="voice-language"
            >
              Language
            </label>
            <Select
              id="voice-language"
              value={language}
              onChange={(event) => setVoiceLanguage(event.target.value)}
            >
              {VOICE_LANGUAGES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-faint-foreground">
              The recogniser expects this accent. Changing it restarts listening.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => (listening ? stopListening() : setOpen(false))}
          >
            {listening ? "Stop listening" : "Close"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
