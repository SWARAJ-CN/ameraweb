"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowDownToLine,
  Check,
  Copy,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/Controls";
import { cn } from "@/lib/cn";
import { getRequestLog, subscribeRequestLog } from "@/lib/reqlog";
import {
  fetchServerLogs,
  LogUnavailableError,
  type LogEntry,
  type LogLevel,
} from "@/lib/serverlog";

/** How often the panel asks the server for lines it has not seen. */
const POLL_MS = 3000;
/** Lines kept on screen; older ones scroll away. */
const VISIBLE_LIMIT = 250;
/** Distance from the bottom that still counts as "following the tail". */
const FOLLOW_SLACK_PX = 24;

const LEVELS: Array<{ value: "all" | LogLevel; label: string }> = [
  { value: "all", label: "All" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

/**
 * Live log of backend activity.
 *
 * Prefers the server's own log — every request it has served, from any device.
 * When that route is missing (an older deployed build), it falls back to the
 * requests this browser is making, which need no server support and are just as
 * useful minute to minute. Both sources produce identical rows.
 */
export function ServerLog() {
  const [serverEntries, setServerEntries] = useState<LogEntry[]>([]);
  const [source, setSource] = useState<"server" | "device">("server");
  const [checked, setChecked] = useState(false);
  const [live, setLive] = useState(true);
  const [level, setLevel] = useState<"all" | LogLevel>("all");
  const [capacity, setCapacity] = useState({ count: 0, max: 0 });
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(true);
  const [deviceFloor, setDeviceFloor] = useState(0);
  /** Snapshot taken when the device log is paused. */
  const [frozenDevice, setFrozenDevice] = useState<LogEntry[] | null>(null);

  /** Highest server id already on screen; polls ask for everything above it. */
  const cursor = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  /* ---- this browser's own calls ---- */
  const deviceLog = useSyncExternalStore(subscribeRequestLog, getRequestLog, getRequestLog);
  // Local ids count down, so "newer than the clear point" means a smaller id.
  const deviceRows = useMemo(
    () => (deviceFloor === 0 ? deviceLog : deviceLog.filter((entry) => entry.id < deviceFloor)),
    [deviceLog, deviceFloor]
  );
  const deviceEntries = useMemo(() => deviceRows.slice(-VISIBLE_LIMIT), [deviceRows]);

  /* ---- the server's own log ---- */
  useEffect(() => {
    if (source !== "server" || !live) return;
    let cancelled = false;

    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const snapshot = await fetchServerLogs(cursor.current);
        if (cancelled) return;

        cursor.current = snapshot.lastId;
        if (snapshot.entries.length) {
          setServerEntries((previous) =>
            [...previous, ...snapshot.entries].slice(-VISIBLE_LIMIT)
          );
        }
        setCapacity({ count: snapshot.count, max: snapshot.max });
        setChecked(true);
      } catch (error) {
        if (cancelled) return;
        setChecked(true);
        // A 404 means this build predates the route — use what we can see instead.
        if (error instanceof LogUnavailableError) setSource("device");
      }
    };

    void poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [source, live]);

  const entries = source === "device" ? (frozenDevice ?? deviceEntries) : serverEntries;

  const shown = useMemo(
    () => (level === "all" ? entries : entries.filter((entry) => entry.level === level)),
    [entries, level]
  );

  // Keep the newest line in view unless the reader has scrolled back.
  useEffect(() => {
    const node = listRef.current;
    if (!following || !node) return;
    node.scrollTop = node.scrollHeight;
  }, [shown.length, following]);

  const handleScroll = useCallback(() => {
    const node = listRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setFollowing(distance <= FOLLOW_SLACK_PX);
  }, []);

  const jumpToLatest = () => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
    setFollowing(true);
  };

  const toggleLive = () => {
    if (live) {
      if (source === "device") setFrozenDevice(deviceEntries);
      setLive(false);
      return;
    }
    setFrozenDevice(null);
    setLive(true);
  };

  const clear = () => {
    if (source === "device") {
      // Raise the floor instead of freezing the list, so new lines still arrive.
      const newest = deviceRows.at(-1);
      // Local ids count down, so "newer than" means a smaller id.
      if (newest && (deviceFloor === 0 || newest.id < deviceFloor)) {
        setDeviceFloor(newest.id);
      }
      // A paused panel would otherwise keep showing the rows it was holding.
      if (frozenDevice !== null) setFrozenDevice([]);
      return;
    }
    // The server cursor stays put, so cleared lines do not stream straight back.
    setServerEntries([]);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown.map(lineText).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* the clipboard can be blocked — the log stays readable on screen */
    }
  };

  const useServerLog = () => {
    cursor.current = 0;
    setServerEntries([]);
    setChecked(false);
    setSource("server");
  };

  const bad = entries.filter((entry) => entry.level !== "info").length;
  const streaming = live && (source === "device" || checked);
  const onDevice = source === "device";

  return (
    <Card className="overflow-clip">
      <CardHeader
        title="Live log"
        description={
          onDevice
            ? "Requests this browser has made to the backend, newest last."
            : "Every request the backend has served since it last restarted, newest last."
        }
        actions={
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                streaming
                  ? "bg-success-soft text-success-soft-foreground"
                  : "bg-surface-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  streaming ? "bg-success" : "bg-muted-foreground"
                )}
              />
              {live ? (onDevice ? "Live · this device" : "Live · server") : "Paused"}
            </span>

            <SegmentedControl
              ariaLabel="Filter log lines"
              options={LEVELS}
              value={level}
              onChange={(next) => setLevel(next as "all" | LogLevel)}
            />

            <Button size="sm" variant="ghost" onClick={toggleLive}>
              {live ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {live ? "Pause" : "Resume"}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              aria-label="Clear the log view"
              title="Clear the log view"
              onClick={clear}
            >
              <Trash2 className="size-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              aria-label="Copy visible log lines"
              title="Copy visible log lines"
              onClick={copy}
            >
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            </Button>
          </>
        }
      />

      <div className="relative">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="amare-log max-h-[26rem] overflow-auto bg-surface-inset"
        >
          {shown.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              {entries.length === 0
                ? onDevice
                  ? "Nothing yet — the log fills as this admin talks to the backend."
                  : "Waiting for the first request…"
                : "No lines match this filter."}
            </p>
          ) : (
            <ol>
              {shown.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-baseline gap-3 border-b border-border/60 px-4 py-1.5 font-mono text-xs last:border-b-0"
                >
                  <span className="w-16 flex-none tabular-nums text-faint-foreground">
                    {logTime(entry.at)}
                  </span>
                  <span
                    className={cn(
                      "w-8 flex-none text-right font-semibold tabular-nums",
                      statusTone(entry)
                    )}
                  >
                    {entry.status ?? "—"}
                  </span>
                  <span className="w-11 flex-none font-semibold text-muted-foreground">
                    {entry.method ?? ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {entry.path ? entry.path : (entry.message ?? "—")}
                    {entry.path && entry.message ? (
                      <span className="text-muted-foreground">
                        {" · "}
                        {entry.message}
                      </span>
                    ) : null}
                  </span>
                  {entry.durationMs !== undefined ? (
                    <span className="flex-none tabular-nums text-faint-foreground">
                      {entry.durationMs} ms
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>

        {!following && shown.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={jumpToLatest}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-sm"
          >
            <ArrowDownToLine className="size-3.5" />
            Jump to latest
          </Button>
        ) : null}
      </div>

      {onDevice ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-separator bg-surface-muted px-5 py-2.5 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1">
            The backend&apos;s own log switches on once the current server build is deployed.
            Until then this shows what this browser asks it for.
          </span>
          <Button size="sm" variant="outline" onClick={useServerLog}>
            <RefreshCw className="size-3.5" />
            Try the server log
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator px-5 py-3 text-xs text-muted-foreground">
        <span>
          {shown.length} of {entries.length} line{entries.length === 1 ? "" : "s"} shown
          {level === "all" ? "" : ` · filtered to ${level}`}
          {bad > 0 ? (
            <span className="ms-2 text-warning">
              {bad} warning{bad === 1 ? "" : "s"} / error{bad === 1 ? "" : "s"}
            </span>
          ) : null}
        </span>
        <span>
          {onDevice
            ? "Kept on this device"
            : capacity.max > 0
              ? `Server buffer ${capacity.count}/${capacity.max}`
              : "Waiting for the server buffer…"}
        </span>
      </div>
    </Card>
  );
}

function statusTone(entry: LogEntry): string {
  if (entry.level === "error") return "text-danger";
  if (entry.level === "warn") return "text-warning";
  if (entry.status == null) return "text-faint-foreground";
  return "text-success";
}

function logTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Flat text form, for the clipboard. */
function lineText(entry: LogEntry): string {
  const parts = [
    entry.at,
    entry.level.toUpperCase().padEnd(5),
    entry.status == null ? "---" : String(entry.status),
    (entry.method ?? "").padEnd(6),
    entry.path ?? entry.message ?? "",
  ];
  if (entry.path && entry.message) parts.push(`(${entry.message})`);
  if (entry.durationMs !== undefined) parts.push(`${entry.durationMs}ms`);
  return parts.join(" ").replace(/\s+$/, "");
}
