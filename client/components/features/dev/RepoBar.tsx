"use client";

import type { ReactNode } from "react";
import {
  CircleDot,
  Eye,
  GitFork,
  Globe,
  KeyRound,
  Lock,
  MessageCircle,
  Star,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { DevRepo } from "@/lib/dev-types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ExternalButton } from "./DevBits";

interface RepoBarProps {
  repo: DevRepo;
  onNotifyDev: () => void;
}

function Fact({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[10px] font-semibold tracking-wide text-faint-foreground uppercase">
        {label}
      </span>
      <span className={cn("text-xs font-medium text-foreground", mono && "font-mono")}>
        {children}
      </span>
    </span>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap" title={`${value} ${label}`}>
      {icon}
      <span className="tabular-nums">{value.toLocaleString("en-IN")}</span>
    </span>
  );
}

/**
 * The repository identity strip.
 *
 * Everything the old status card showed is still here, but as two dense rows
 * instead of a card stacked with oversized stat tiles — this is context for
 * the tools below it, not a dashboard in its own right.
 */
export function RepoBar({ repo, onNotifyDev }: RepoBarProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 p-4">
        {repo.user.avatarUrl ? (
          <img
            src={repo.user.avatarUrl}
            alt=""
            className="size-9 flex-none rounded-lg ring-1 ring-border"
          />
        ) : (
          <span className="grid size-9 flex-none place-items-center rounded-lg bg-surface-muted text-muted">
            <KeyRound className="size-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="max-w-full truncate text-sm font-semibold text-foreground transition-colors duration-150 hover:text-accent"
            >
              {repo.fullName}
            </a>
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
                <Tag className="size-3" />
                {repo.license}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {repo.description || "No description on the repository."}
          </p>
        </div>

        <div className="flex flex-none items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onNotifyDev}>
            <MessageCircle className="size-4" />
            Notify dev
          </Button>
          <ExternalButton href={repo.htmlUrl}>Open on GitHub</ExternalButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-separator bg-surface-muted px-4 py-2.5">
        <Fact label="Branch" mono>
          {repo.defaultBranch}
        </Fact>
        <Fact label="Signed in">@{repo.user.login}</Fact>
        <Fact label="Pushed">
          {repo.pushedAt ? relativeTime(repo.pushedAt) : "—"}
        </Fact>

        <span className="hidden h-3.5 w-px bg-separator sm:block" />

        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <Metric icon={<Star className="size-3.5" />} value={repo.stars} label="stars" />
          <Metric icon={<GitFork className="size-3.5" />} value={repo.forks} label="forks" />
          <Metric icon={<Eye className="size-3.5" />} value={repo.watchers} label="watchers" />
          <Metric
            icon={<CircleDot className="size-3.5" />}
            value={repo.openIssues}
            label="open issues"
          />
          <span className="whitespace-nowrap tabular-nums">
            {repo.sizeKb.toLocaleString("en-IN")} KB
          </span>
        </span>

        <span className="ms-auto flex flex-wrap items-center gap-1.5">
          {repo.permissions.admin ? <Badge tone="success">admin</Badge> : null}
          {repo.permissions.push ? <Badge tone="success">push</Badge> : null}
          {repo.permissions.maintain ? <Badge tone="info">maintain</Badge> : null}
          {repo.permissions.pull ? <Badge tone="neutral">read</Badge> : null}

          {repo.rateLimit ? (
            <Badge
              tone={repo.rateLimit.remaining > 500 ? "neutral" : "warning"}
              title={`GitHub API calls left, resetting ${relativeTime(repo.rateLimit.resetAt)}`}
            >
              API {repo.rateLimit.remaining.toLocaleString("en-IN")}/
              {repo.rateLimit.limit.toLocaleString("en-IN")}
            </Badge>
          ) : null}

          <Badge
            tone={repo.tokenSource === "env" ? "success" : "warning"}
            title="GitHub calls are made from the server — the token never reaches this page."
          >
            token {repo.tokenSource === "env" ? "set" : "missing"}
          </Badge>
        </span>
      </div>
    </section>
  );
}
