"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { probeEndpoint, type EndpointProbe } from "@/lib/server";

export type ServerState = "checking" | "online" | "offline";

interface ServerStatusValue {
  state: ServerState;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  /** True while a manual check is in flight. */
  checking: boolean;
  check: () => Promise<void>;
}

const HEALTH = {
  key: "health",
  label: "Health check",
  method: "GET" as const,
  path: "/health",
};

const POLL_MS = 60_000;

const ServerStatusContext = createContext<ServerStatusValue | null>(null);

export function ServerStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServerState>("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const record = useCallback((probe: EndpointProbe) => {
    setState(probe.ok ? "online" : "offline");
    setLatencyMs(probe.ok ? probe.latencyMs : null);
    setLastCheckedAt(probe.checkedAt);
  }, []);

  // Background poll. State is only touched after the await so the effect never
  // triggers a synchronous re-render.
  useEffect(() => {
    let active = true;
    const run = async () => {
      const probe = await probeEndpoint(HEALTH);
      if (!active) return;
      record(probe);
    };
    void run();
    const id = window.setInterval(() => void run(), POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [record]);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      record(await probeEndpoint(HEALTH));
    } finally {
      setChecking(false);
    }
  }, [record]);

  const value = useMemo<ServerStatusValue>(
    () => ({ state, latencyMs, lastCheckedAt, checking, check }),
    [state, latencyMs, lastCheckedAt, checking, check]
  );

  return (
    <ServerStatusContext.Provider value={value}>{children}</ServerStatusContext.Provider>
  );
}

export function useServerStatus(): ServerStatusValue {
  const context = useContext(ServerStatusContext);
  if (!context) {
    throw new Error("useServerStatus must be used within ServerStatusProvider");
  }
  return context;
}
