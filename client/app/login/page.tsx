"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BarChart3, Package, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useAuth } from "@/components/providers/AuthProvider";
import { Splash } from "@/components/layout/Splash";

type Mode = "login" | "register";

const HIGHLIGHTS = [
  { icon: BarChart3, title: "Live dashboard", body: "Revenue, expenses and profit at a glance." },
  { icon: Wallet, title: "Simple billing", body: "Create bills, custom orders and track spending." },
  { icon: Package, title: "Product catalogue", body: "Keep every handmade piece and its price handy." },
];

export default function LoginPage() {
  const { user, ready, login, register, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  if (!ready || user) return <Splash label="Checking your session…" />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const name = username.trim();
    if (name.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (mode === "register" && (password.length < 8 || !/\d/.test(password))) {
      setError("Password must be at least 8 characters and include a number.");
      return;
    }

    try {
      if (mode === "login") await login(name, password);
      else await register(name, password);
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside
        className="relative hidden flex-col justify-between overflow-clip p-10 text-white lg:flex"
        style={{
          background:
            "linear-gradient(150deg, oklch(0.5 0.2 8), oklch(0.42 0.19 350) 55%, oklch(0.34 0.15 320))",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -end-24 size-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, white, transparent 65%)" }}
        />
        <div className="relative flex items-center gap-3">
          <Image
            src="/logo.jpeg"
            alt="Amare Handmades"
            width={48}
            height={48}
            priority
            className="size-12 rounded-2xl object-cover ring-1 ring-white/40"
          />
          <div>
            <p className="text-lg font-bold">Amare Handmades</p>
            <p className="text-sm text-white/75">Studio administration</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold tracking-tight text-balance">
            Everything your handmade business needs, in one calm workspace.
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="grid size-9 flex-none place-items-center rounded-xl bg-white/15">
                  <item.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-sm text-white/75">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="size-3.5" />
          Data is shared across studio accounts and protected by bearer tokens.
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/logo.jpeg"
              alt="Amare Handmades"
              width={44}
              height={44}
              priority
              className="size-11 rounded-2xl object-cover ring-1 ring-border"
            />
            <div>
              <p className="text-base font-bold text-foreground">Amare Handmades</p>
              <p className="text-xs text-muted-foreground">Studio administration</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === "login" ? "Welcome back" : "Create an account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to manage sales, expenses and reports."
              : "The first account becomes the studio owner."}
          </p>

          <div
            role="group"
            aria-label="Authentication mode"
            className="mt-6 grid grid-cols-2 gap-1 rounded-field bg-segment p-1 shadow-field"
          >
            {(["login", "register"] as Mode[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => {
                  setMode(option);
                  setError(null);
                }}
                className={`rounded-[calc(var(--radius-field)-3px)] px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                  mode === option
                    ? "bg-surface text-foreground shadow-field"
                    : "text-segment-foreground hover:text-foreground"
                }`}
              >
                {option === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <Field label="Username" htmlFor="username" required>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="studio-owner"
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              required
              hint={mode === "register" ? "At least 8 characters, including a number." : undefined}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-transparent bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-foreground"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-faint-foreground">
            Connected to the Amare API on Render. First load may take a moment while the
            server wakes up.
          </p>
        </div>
      </main>
    </div>
  );
}
