"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock,
  Gauge,
  RefreshCw,
  Server,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { API_URL } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Notice, Skeleton } from "@/components/ui/Feedback";
import { PageHeader, SegmentedControl } from "@/components/ui/Controls";
import { Sparkline } from "@/components/charts/Sparkline";
import { probeEndpoint, SERVER_ENDPOINTS, type EndpointProbe } from "@/lib/server";

const INTERVALS = [
  { value: "0", label: "Off" },
  { value: "15000", label: "15s" },
  { value: "30000", label: "30s" },
  { value: "60000", label: "1m" },
  { value: "300000", label: "5m" },
];

type Overall = "checking" | "online" | "degraded" | "offline";

const OVERALL: Record<
  Overall,
  { label: string; description: string; tone: string; icon: typeof Activity; badge: "success" | "warning" | "danger" | "neutral" }
> = {
  checking: {
    label: "Checking…",
    description: "Contacting the backend for the first time.",
    tone: "bg-surface-muted text-muted-foreground",
    icon: RefreshCw,
    badge: "neutral",
  },
  online: {
    label: "All systems online",
    description: "The backend is responding to every public endpoint.",
    tone: "bg-success-soft text-success-soft-foreground",
    icon: Activity,
    badge: "success",
  },
  degraded: {
    label: "Partially degraded",
    description: "Some endpoints responded, but the health check did not.",
    tone: "bg-warning-soft text-warning-soft-foreground",
    icon: ShieldCheck,
    badge: "warning",
  },
  offline: {
    label: "Server unreachable",
    description: "No endpoint answered. On the free tier the service may be asleep.",
    tone: "bg-danger-soft text-danger-soft-foreground",
    icon: WifiOff,
    badge: "danger",
  },
};

export default function ServerPage() {
  const [probes, setProbes] = useState<Record<string, EndpointProbe>>({});
  const [history, setHistory] = useState<number[]>([]);
  const [lastSweepAt, setLastSweepAt] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepToken, setSweepToken] = useState(0);
  const [intervalMs, setIntervalMs] = useState(30000);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  // Runs on mount and whenever the sweep token changes (manual or interval).
  // State is only written after the awaits, so the effect never triggers a
  // synchronous re-render.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const results = await Promise.all(
        SERVER_ENDPOINTS.map((spec) => probeEndpoint(spec))
      );
      if (cancelled) return;

      const next: Record<string, EndpointProbe> = {};
      SERVER_ENDPOINTS.forEach((spec, index) => {
        next[spec.key] = results[index];
      });

      setProbes((previous) => ({ ...previous, ...next }));
      setLastSweepAt(new Date().toISOString());

      const health = next.health;
      if (health?.ok) {
        setHistory((previous) => [...previous.slice(-39), health.latencyMs]);
      }
      setSweeping(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sweepToken]);

  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = window.setInterval(
      () => setSweepToken((token) => token + 1),
      intervalMs
    );
    return () => window.clearInterval(id);
  }, [intervalMs]);

  const checkNow = () => {
    setSweeping(true);
    setSweepToken((token) => token + 1);
  };

  // Session uptime ticker.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const health = probes.health;
  const passed = SERVER_ENDPOINTS.filter((spec) => probes[spec.key]?.ok).length;
  const total = SERVER_ENDPOINTS.length;

  const overall: Overall = useMemo(() => {
    if (!health && !lastSweepAt) return "checking";
    if (health?.ok) return "online";
    const anyOther = probes.root?.ok || probes.graphql?.ok || probes.auth?.ok;
    return anyOther ? "degraded" : "offline";
  }, [health, lastSweepAt, probes]);

  const view = OVERALL[overall];
  const OverallIcon = view.icon;

  const latency = health?.ok ? health.latencyMs : null;
  const stats = useMemo(() => {
    if (!history.length) return null;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const avg = history.reduce((sum, value) => sum + value, 0) / history.length;
    return { min, max, avg };
  }, [history]);

  return (
    <>
      <PageHeader
        title="Server"
        description="Live health of the backend that powers this admin."
        actions={
          <>
            <SegmentedControl
              ariaLabel="Auto-refresh interval"
              options={INTERVALS}
              value={String(intervalMs)}
              onChange={(value) => setIntervalMs(Number(value))}
            />
            <Button variant="outline" onClick={checkNow} loading={sweeping}>
              <RefreshCw className={cn("size-4", sweeping && "animate-spin")} />
              Check now
            </Button>
          </>
        }
      />

      {overall === "offline" ? (
        <Notice
          tone="warning"
          title="The server may be waking up"
          action={
            <Button variant="outline" size="sm" onClick={checkNow}>
              Try again
            </Button>
          }
        >
          This project runs on a free tier that sleeps after a period of inactivity. The first
          request can take up to a minute while the instance boots.
        </Notice>
      ) : null}

      <Card className="overflow-clip">
        <CardContent className="flex flex-wrap items-center gap-5 p-5">
          <span
            className={cn(
              "grid size-14 flex-none place-items-center rounded-2xl",
              view.tone
            )}
          >
            <OverallIcon
              className={cn("size-7", overall === "checking" && "animate-spin")}
            />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{view.label}</h2>
              <Badge tone={view.badge}>
                {passed}/{total} responding
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{view.description}</p>
            <code className="mt-2 inline-block rounded-md bg-surface-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {API_URL}
            </code>
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-3">
            <Metric
              icon={Gauge}
              label="Latency"
              value={latency !== null ? `${latency} ms` : "—"}
            />
            <Metric
              icon={ShieldCheck}
              label="Last checked"
              value={lastSweepAt ? clockTime(lastSweepAt) : "—"}
            />
            <Metric icon={Clock} label="Uptime" value={formatUptime(now - startedAt)} />
          </dl>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Endpoint checks"
            description="Public routes used to judge whether the backend is healthy."
          />
          <ul className="divide-y divide-border">
            {SERVER_ENDPOINTS.map((spec) => {
              const probe = probes[spec.key];
              return (
                <li key={spec.key} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone={spec.method === "GET" ? "info" : "brand"}>
                      {spec.method}
                    </Badge>
                    <code className="font-mono text-sm text-foreground">{spec.path}</code>
                    <span className="text-xs text-muted-foreground">{spec.label}</span>

                    <div className="ms-auto flex flex-none items-center gap-3">
                      {probe ? (
                        <>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {probe.latencyMs} ms
                          </span>
                          <Badge tone={probeTone(probe)}>
                            {probe.status === null ? "No response" : probe.status}
                          </Badge>
                        </>
                      ) : (
                        <Skeleton className="h-6 w-24 rounded-full" />
                      )}
                    </div>
                  </div>

                  {spec.note ? (
                    <p className="mt-2 text-xs text-faint-foreground">{spec.note}</p>
                  ) : null}

                  {probe?.error ? (
                    <p className="mt-2 text-xs text-danger">{probe.error}</p>
                  ) : probe?.body ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground">
                        Response body
                      </summary>
                      <pre className="mt-2 max-h-52 overflow-auto rounded-lg border border-border bg-surface-inset p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                        {prettify(probe.body)}
                      </pre>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Health latency"
            description="Recent /health round-trip times for this session."
          />
          <CardContent className="flex flex-col gap-4">
            {history.length > 1 ? (
              <>
                <Sparkline
                  values={history}
                  color="var(--brand)"
                  width={320}
                  height={80}
                  className="h-20 w-full"
                />
                <dl className="grid grid-cols-3 gap-3">
                  <MiniStat label="Min" value={`${stats?.min} ms`} />
                  <MiniStat label="Avg" value={`${Math.round(stats?.avg ?? 0)} ms`} />
                  <MiniStat label="Max" value={`${stats?.max} ms`} />
                </dl>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Server className="size-6 text-faint-foreground" />
                <p className="text-sm text-muted-foreground">
                  Not enough samples yet. Latency is charted after a couple of successful
                  health checks.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted px-3 py-2">
      <dt className="text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function probeTone(probe: EndpointProbe): "success" | "warning" | "danger" {
  if (probe.status === null) return "danger";
  return probe.ok ? "success" : "warning";
}

function clockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatUptime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function prettify(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "(empty response)";
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}…` : trimmed;
  }
}
