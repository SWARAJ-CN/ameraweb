"use client";

import { GitCommitHorizontal, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { DevCommitSummary } from "@/lib/dev-types";
import { relativeTime } from "@/lib/format";
import { ExternalButton } from "./DevBits";

interface CommitsPanelProps {
  commits: DevCommitSummary[];
  branch: string;
  loading: boolean;
  onRefresh: () => void;
}

export function CommitsPanel({ commits, branch, loading, onRefresh }: CommitsPanelProps) {
  return (
    <Card className="overflow-clip">
      <CardHeader
        title="Recent commits"
        description={
          <span className="font-mono">
            {branch} · {commits.length} shown
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={onRefresh} loading={loading}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />

      {loading && !commits.length ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : commits.length ? (
        <TableWrapper>
          <Table>
            <THead>
              <TR>
                <TH>Commit</TH>
                <TH>Message</TH>
                <TH>Author</TH>
                <TH>When</TH>
                <TH className="text-end">Link</TH>
              </TR>
            </THead>
            <TBody>
              {commits.map((commit) => (
                <TR key={commit.sha}>
                  <TD>
                    <Badge tone="neutral">
                      <GitCommitHorizontal className="size-3" />
                      <span className="font-mono">{commit.shortSha}</span>
                    </Badge>
                  </TD>
                  <TD className="max-w-md">
                    <span className="line-clamp-2 text-sm text-foreground">
                      {commit.message.split("\n")[0]}
                    </span>
                  </TD>
                  <TD>
                    <span className="flex items-center gap-2">
                      {commit.authorAvatar ? (
                        <img
                          src={commit.authorAvatar}
                          alt=""
                          className="size-5 rounded-full ring-1 ring-border"
                        />
                      ) : null}
                      <span className="text-xs text-muted-foreground">{commit.authorName}</span>
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">
                    {commit.date ? relativeTime(commit.date) : "—"}
                  </TD>
                  <TD className="text-end">
                    <ExternalButton href={commit.htmlUrl} variant="ghost" size="sm">
                      Open
                    </ExternalButton>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      ) : (
        <EmptyState
          icon={<GitCommitHorizontal className="size-6" />}
          title="No commits"
          description="This branch has no commits yet."
        />
      )}
    </Card>
  );
}
