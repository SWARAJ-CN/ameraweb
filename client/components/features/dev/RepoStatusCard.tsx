"use client";

import {
  Eye,
  GitFork,
  Globe,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Star,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { DevRepo } from "@/lib/dev-types";
import { formatDateTime, relativeTime } from "@/lib/format";
import { DevStat, ExternalButton, Meta } from "./DevBits";

interface RepoStatusCardProps {
  repo: DevRepo;
  refreshing: boolean;
  onRefresh: () => void;
  onNotifyDev: () => void;
}

export function RepoStatusCard({
  repo,
  refreshing,
  onRefresh,
  onNotifyDev,
}: RepoStatusCardProps) {
  return (
    <Card>
      <CardHeader
        title="Repository status"
        description={`${repo.owner}/${repo.name}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={onNotifyDev}>
              Notify dev
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <ExternalButton href={repo.htmlUrl}>Open on GitHub</ExternalButton>
          </>
        }
      />

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start gap-4">
          {repo.user.avatarUrl ? (
            <img
              src={repo.user.avatarUrl}
              alt={repo.user.login}
              className="size-12 flex-none rounded-xl ring-1 ring-border"
            />
          ) : (
            <span className="grid size-12 flex-none place-items-center rounded-xl bg-surface-muted text-muted">
              <KeyRound className="size-5" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground">{repo.fullName}</h2>
              <Badge tone={repo.private ? "warning" : "info"}>
                {repo.private ? (
                  <>
                    <Lock className="size-3" /> private
                  </>
                ) : (
                  <>
                    <Globe className="size-3" /> public
                  </>
                )}
              </Badge>
              {repo.language ? <Badge tone="neutral">{repo.language}</Badge> : null}
              {repo.license ? (
                <Badge tone="neutral">
                  <Tag className="size-3" /> {repo.license}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {repo.description || "No description on the repository."}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <Meta
                label="Default branch"
                value={
                  <span className="inline-flex items-center gap-1 font-mono">
                    <GitFork className="size-3.5 text-muted" />
                    {repo.defaultBranch}
                  </span>
                }
              />
              <Meta label="Signed in as" value={`@${repo.user.login}`} />
              <Meta
                label="Last push"
                value={repo.pushedAt ? relativeTime(repo.pushedAt) : "—"}
              />
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <DevStat icon={<Star className="size-3.5" />} label="Stars" value={repo.stars} />
          <DevStat icon={<GitFork className="size-3.5" />} label="Forks" value={repo.forks} />
          <DevStat icon={<Eye className="size-3.5" />} label="Watchers" value={repo.watchers} />
          <DevStat label="Open issues" value={repo.openIssues} />
          <DevStat label="Size" value={`${repo.sizeKb.toLocaleString("en-IN")} KB`} />
        </dl>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-surface-muted px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
              Your access
            </span>
            {repo.permissions.admin ? <Badge tone="success">admin</Badge> : null}
            {repo.permissions.push ? <Badge tone="success">push</Badge> : null}
            {repo.permissions.maintain ? <Badge tone="info">maintain</Badge> : null}
            {repo.permissions.pull ? <Badge tone="neutral">read</Badge> : null}
          </div>

          {repo.rateLimit ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
                API budget
              </span>
              <Badge tone={repo.rateLimit.remaining > 500 ? "success" : "warning"}>
                {repo.rateLimit.remaining}/{repo.rateLimit.limit} left
              </Badge>
              <span className="text-xs text-muted-foreground">
                resets {relativeTime(repo.rateLimit.resetAt)}
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
              Token
            </span>
            <Badge tone={repo.tokenSource === "env" ? "success" : "warning"}>
              <ShieldCheck className="size-3" />
              {repo.tokenSource === "env" ? "from environment" : "not configured"}
            </Badge>
          </div>

          <Meta label="Created" value={repo.createdAt ? formatDateTime(repo.createdAt) : "—"} />
        </div>
      </CardContent>
    </Card>
  );
}
