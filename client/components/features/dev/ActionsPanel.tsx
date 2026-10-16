"use client";

import { Activity, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { DevRun } from "@/lib/dev-types";
import { relativeTime } from "@/lib/format";
import { ExternalButton } from "./DevBits";
import { runLabel, runTone } from "./dev-utils";

interface ActionsPanelProps {
  runs: DevRun[];
  loading: boolean;
  onRefresh: () => void;
}

export function ActionsPanel({ runs, loading, onRefresh }: ActionsPanelProps) {
  return (
    <Card className="overflow-clip">
      <CardHeader
        title="Workflow runs"
        description={`${runs.length} most recent runs on this repository`}
        actions={
          <Button variant="outline" size="sm" onClick={onRefresh} loading={loading}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />

      {loading && !runs.length ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : runs.length ? (
        <TableWrapper>
          <Table>
            <THead>
              <TR>
                <TH>Workflow</TH>
                <TH>Status</TH>
                <TH>Branch</TH>
                <TH>Event</TH>
                <TH>Actor</TH>
                <TH>When</TH>
                <TH className="text-end">Link</TH>
              </TR>
            </THead>
            <TBody>
              {runs.map((run) => (
                <TR key={run.id}>
                  <TD>
                    <span className="flex items-center gap-2">
                      <Activity className="size-4 flex-none text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {run.name}
                        </span>
                        <span className="block font-mono text-[11px] text-faint-foreground">
                          #{run.runNumber} · {run.sha.slice(0, 7)}
                        </span>
                      </span>
                    </span>
                  </TD>
                  <TD>
                    <Badge tone={runTone(run)}>{runLabel(run)}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {run.branch || "—"}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{run.event}</TD>
                  <TD>
                    <span className="flex items-center gap-2">
                      {run.actorAvatar ? (
                        <img
                          src={run.actorAvatar}
                          alt=""
                          className="size-5 rounded-full ring-1 ring-border"
                        />
                      ) : null}
                      <span className="text-xs text-muted-foreground">{run.actor}</span>
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">
                    {relativeTime(run.createdAt)}
                  </TD>
                  <TD className="text-end">
                    <ExternalButton href={run.htmlUrl} variant="ghost" size="sm">
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
          icon={<Activity className="size-6" />}
          title="No workflow runs"
          description="This repository has no GitHub Actions runs yet, or Actions is disabled."
        />
      )}
    </Card>
  );
}
