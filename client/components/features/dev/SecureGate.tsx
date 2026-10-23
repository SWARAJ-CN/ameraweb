"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Check,
  Lock,
  LockOpen,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Notice, Spinner } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ *
 * Unlock store (sessionStorage-backed, lint-safe via useSyncExternalStore)
 * One unlock opens BOTH locked tabs (Developer + Server) for the session.
 * ------------------------------------------------------------------ */

const GATE_KEY = "dev:gate";
const gateListeners = new Set<() => void>();

function readGate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(GATE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeGate(onChange: () => void): () => void {
  gateListeners.add(onChange);
  return () => {
    gateListeners.delete(onChange);
  };
}

function writeGate(value: boolean): void {
  try {
    if (value) window.sessionStorage.setItem(GATE_KEY, "1");
    else window.sessionStorage.removeItem(GATE_KEY);
  } catch {
    /* storage unavailable — unlocked becomes memory-only */
  }
  gateListeners.forEach((listener) => listener());
}

/* ------------------------------------------------------------------ *
 * Quiz catalogue — 2 minimal, 2 medium, 1 hard
 * ------------------------------------------------------------------ */

type Difficulty = "minimal" | "medium" | "hard";

interface QuizQuestion {
  difficulty: Difficulty;
  prompt: string;
  hint: string;
  normalize: (answer: string) => string;
  accept: string[];
}

const NORMAL = (value: string) => value.toLowerCase().replace(/\s+/g, "");

const QUIZ: readonly QuizQuestion[] = [
  {
    difficulty: "minimal",
    prompt: "typeof null",
    hint: "Beware JS's most famous 30-year-old bug.",
    normalize: NORMAL,
    accept: ['"object"', "object", "'object'"],
  },
  {
    difficulty: "minimal",
    prompt: "'5' + 3",
    hint: "Plus prefers strings when either side has one.",
    normalize: NORMAL,
    accept: ['"53"', "'53'", "53"],
  },
  {
    difficulty: "medium",
    prompt: "0.1 + 0.2 === 0.3",
    hint: "IEEE-754 has opinions.",
    normalize: NORMAL,
    accept: ["false"],
  },
  {
    difficulty: "medium",
    prompt: "typeof NaN",
    hint: "Not a… number class, apparently.",
    normalize: NORMAL,
    accept: ['"number"', "number", "'number'"],
  },
  {
    difficulty: "hard",
    prompt: "['1','7','11'].map(parseInt)",
    hint: "parseInt receives an extra argument from map…",
    normalize: (value) =>
      value.replace(/[\[\]\s()'"]/g, "").replace(/^,/, "").toLowerCase(),
    accept: ["1,nan,3", "'1,nan,3'"],
  },
];

const DIFFICULTY_CHIP: Record<Difficulty, string> = {
  minimal: "bg-accent-soft text-brand",
  medium: "bg-warning-soft text-warning-foreground",
  hard: "bg-foreground text-background",
};

/* ------------------------------------------------------------------ *
 * SecureGate — wraps the Developer & Server pages
 * ------------------------------------------------------------------ */

export function SecureGate({
  areaName,
  blurb,
  children,
}: {
  areaName: string;
  blurb: string;
  children: ReactNode;
}) {
  const unlocked = useSyncExternalStore(subscribeGate, readGate, () => false);

  const [modal, setModal] = useState<"password" | "quiz" | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [quizIndex, setQuizIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [answer, setAnswer] = useState("");

  const [caught, setCaught] = useState(false);
  const [caughtCount, setCaughtCount] = useState(0);

  /* Tab-switch trap: while the quiz is on screen, leaving the page sets a
     "caught" flag; the confession modal greets the return. */
  useEffect(() => {
    if (modal !== "quiz") return;
    let wasHidden = false;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
      } else if (wasHidden) {
        wasHidden = false;
        setCaught(true);
        setCaughtCount((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [modal]);

  const openSequence = useCallback(() => {
    setPassword("");
    setPasswordError(null);
    setQuizIndex(0);
    setAttempts(0);
    setAnswer("");
    setCaught(false);
    setModal("password");
  }, []);

  const closeAll = useCallback(() => {
    setModal(null);
    setCaught(false);
    setPassword("");
    setPasswordError(null);
    setAnswer("");
    setAttempts(0);
    setQuizIndex(0);
  }, []);

  const lockAgain = useCallback(() => {
    writeGate(false);
    closeAll();
  }, [closeAll]);

  const submitPassword = useCallback(async () => {
    if (!password.trim()) {
      setPasswordError("Type the lock password first.");
      return;
    }
    setVerifying(true);
    setPasswordError(null);
    try {
      const response = await fetch("/api/dev/lock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setPasswordError("Wrong password — the lock stayed shut.");
        setVerifying(false);
        return;
      }
      setVerifying(false);
      setModal("quiz");
    } catch {
      setPasswordError("The lock couldn't be reached — try again.");
      setVerifying(false);
    }
  }, [password]);

  const submitAnswer = useCallback(() => {
    const question = QUIZ[quizIndex];
    if (!question) return;
    if (question.accept.includes(question.normalize(answer))) {
      if (quizIndex + 1 >= QUIZ.length) {
        writeGate(true);
        setModal(null);
      } else {
        setQuizIndex((value) => value + 1);
        setAttempts(0);
        setAnswer("");
      }
    } else {
      setAttempts((value) => value + 1);
    }
  }, [answer, quizIndex]);

  const current = QUIZ[quizIndex];

  return (
    <>
      {unlocked ? (
        <div className="flex flex-col gap-3">
          <OpenedBar areaName={areaName} onLock={lockAgain} />
          {children}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-warning-soft text-warning-foreground">
              <Lock className="size-7" />
            </span>
            <p className="text-base font-bold text-foreground">
              {areaName} is sealed 🔒
            </p>
            <p className="max-w-md text-sm text-muted">{blurb}</p>
            <p className="max-w-md text-[11px] text-faint-foreground">
              Opening it needs the lock password — and even then, five
              JavaScript questions (2 easy, 2 medium, 1 hard) stand between you
              and {areaName.toLowerCase()}. Fair warning: switching browser
              tabs mid-quiz triggers a little confession dialog…
            </p>
            <Button variant="primary" size="lg" onClick={openSequence}>
              <LockOpen className="size-4" /> Unlock
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Warning + password modal */}
      {modal === "password" && !unlocked ? (
        <Modal onClose={closeAll}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 flex-none place-items-center rounded-full bg-warning-soft text-warning-foreground">
                <ShieldAlert className="size-6" />
              </span>
              <div>
                <p className="text-base font-bold text-foreground">
                  Restricted area
                </p>
                <p className="text-xs text-muted">
                  {areaName} internals. Proceed only if you know the lock.
                </p>
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lock password
              </span>
              <input
                type="password"
                value={password}
                autoFocus
                autoComplete="off"
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitPassword();
                }}
                placeholder="••••••••••••"
                className={cn(
                  "min-h-10 rounded-field border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-faint-foreground focus:border-accent",
                  passwordError ? "border-danger" : "border-separator"
                )}
              />
              <span className="text-[11px] text-faint-foreground">
                The password lives in the server env — it&apos;s never in the
                page or the bundle.
              </span>
            </label>
            {passwordError ? (
              <Notice tone="warning" title="Access denied">
                {passwordError}
              </Notice>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="md" onClick={closeAll}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void submitPassword()}
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <Spinner className="size-4" /> Checking…
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Continue to quiz
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* 5-question JavaScript quiz */}
      {modal === "quiz" && current ? (
        <Modal onClose={closeAll}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-bold text-foreground">
                JavaScript clearance test
              </p>
              <div className="flex items-center gap-1">
                {QUIZ.map((question, index) => (
                  <span
                    key={index}
                    title={question.difficulty}
                    className={cn(
                      "size-2.5 rounded-full",
                      index < quizIndex
                        ? "bg-accent"
                        : index === quizIndex
                          ? "bg-warning-foreground ring-2 ring-warning-soft"
                          : "bg-separator"
                    )}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-muted">
              Question {quizIndex + 1} of {QUIZ.length} — answer{" "}
              {QUIZ.length - quizIndex} more to open {areaName.toLowerCase()}.
              Tab-switchers get caught. 👀
            </p>
            <div className="rounded-field border border-separator bg-surface-muted p-3">
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  DIFFICULTY_CHIP[current.difficulty]
                )}
              >
                {current.difficulty}
              </span>
              <code className="mt-2 block font-mono text-sm text-foreground">
                {current.prompt}
              </code>
              <p className="mt-1.5 text-[11px] text-faint-foreground">
                {current.hint}
              </p>
            </div>
            <input
              value={answer}
              autoFocus
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitAnswer();
              }}
              placeholder="Your answer (a value or literal)…"
              className="min-h-10 rounded-field border border-separator bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-faint-foreground focus:border-accent"
            />
            {attempts > 0 ? (
              <p className="text-xs font-semibold text-danger">
                Nope ✗ — attempt #{attempts} failed. Re-read the prompt again.
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="md" onClick={closeAll}>
                Close
              </Button>
              <Button variant="primary" size="md" onClick={submitAnswer}>
                Submit answer
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* The confession modal — shown after a tab switch during the quiz */}
      {caught ? (
        <Modal onClose={() => setCaught(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 flex-none place-items-center rounded-full bg-warning-soft text-warning-foreground">
                <ShieldAlert className="size-6" />
              </span>
              <div>
                <p className="text-base font-bold text-foreground">
                  Caught red-handyyyy 🕵️{" "}
                  {caughtCount > 1 ? `× ${caughtCount}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {caughtCount > 1
                    ? "Twice?! Okay okay… the tab judge accepts your plea. 😅"
                    : "You vanished mid-test. Explain yourself."}
                </p>
              </div>
            </div>
            <p className="rounded-field bg-surface-muted p-3 text-sm font-medium text-foreground">
              Hmm… you going to use <strong>ChatGPT</strong>, aren&apos;t you?
              😏 Bro really opened a new tab like the answers live there — bold
              strategy 💀
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => setCaught(false)}
              >
                Agree 😅 guilty
              </Button>
              <Button variant="outline" size="md" onClick={() => setCaught(false)}>
                No, coincidence 👀
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function OpenedBar({
  areaName,
  onLock,
}: {
  areaName: string;
  onLock: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-field border border-separator bg-surface px-3 py-2">
      <span className="grid size-7 flex-none place-items-center rounded-full bg-success-soft text-success-soft-foreground">
        <Check className="size-3.5" />
      </span>
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted">
        {areaName} unsealed for this session — the quiz isn&apos;t asked again
        until you re-lock or close the browser tab.
      </p>
      <Button variant="ghost" size="sm" onClick={onLock}>
        <Lock className="size-3.5" /> Lock again
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Overlay shell
 * ------------------------------------------------------------------ */

function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-field border border-separator bg-surface p-5 shadow-pop"
      >
        {children}
      </div>
    </div>
  );
}
