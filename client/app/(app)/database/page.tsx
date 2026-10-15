"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  RefreshCw,
  Table2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Notice, Skeleton } from "@/components/ui/Feedback";
import { PageHeader, SearchInput } from "@/components/ui/Controls";
import { TBody, TD, TH, THead, TR, Table, TableWrapper } from "@/components/ui/Table";
import { downloadFile } from "@/lib/csv";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { DbCollection, DbTable } from "@/lib/types";

const PAGE_SIZE = 50;

interface DbIndex {
  collections: DbCollection[];
  generatedAt: string;
}

export default function DatabasePage() {
  const toast = useToast();

  const [index, setIndex] = useState<DbIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexToken, setIndexToken] = useState(0);

  const [table, setTable] = useState<string | null>(null);
  const [data, setData] = useState<DbTable | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");

  const [exporting, setExporting] = useState(false);

  // Collection index (counts). State is only touched after the await so the
  // effect never triggers a synchronous re-render.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await api.get<DbIndex>("/api/db");
        if (cancelled) return;
        setIndex({
          collections: result.collections ?? [],
          generatedAt: result.generatedAt ?? "",
        });
        setIndexError(null);
        setTable((current) => current ?? result.collections?.[0]?.name ?? null);
      } catch (caught) {
        if (cancelled) return;
        setIndexError(caught instanceof Error ? caught.message : "Could not load the database.");
      } finally {
        if (!cancelled) setIndexLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [indexToken]);

  // Documents for the selected collection.
  useEffect(() => {
    if (!table) return;
    let cancelled = false;
    const run = async () => {
      try {
        const result = await api.get<DbTable>(
          `/api/db/${encodeURIComponent(table)}?limit=${PAGE_SIZE}&skip=${skip}`
        );
        if (cancelled) return;
        setData(result);
        setDataError(null);
      } catch (caught) {
        if (cancelled) return;
        setData(null);
        if (caught instanceof ApiError && caught.status === 404) {
          setDataError(`“${table}” is not a readable collection.`);
        } else {
          setDataError(
            caught instanceof Error ? caught.message : "Could not load the collection."
          );
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [table, skip]);

  const refreshIndex = () => {
    setIndexLoading(true);
    setIndexToken((token) => token + 1);
  };

  const selectTable = (name: string) => {
    if (name === table) return;
    setDataLoading(true);
    setData(null);
    setTable(name);
    setSkip(0);
    setSearch("");
  };

  const changePage = (nextSkip: number) => {
    setDataLoading(true);
    setSkip(Math.max(0, nextSkip));
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const payload = await api.get<unknown>("/api/db/export");
      downloadFile(
        `amare-database-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(payload, null, 2),
        "application/json"
      );
      toast.success("Backup downloaded", "Full database export saved as JSON.");
    } catch (caught) {
      toast.error("Export failed", caught instanceof Error ? caught.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const documents = data?.documents ?? [];

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const document of data?.documents ?? []) {
      for (const key of Object.keys(document)) {
        if (key !== "__v") keys.add(key);
      }
    }
    return [...keys];
  }, [data]);

  const visibleDocuments = useMemo(() => {
    const list = data?.documents ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((document) =>
      JSON.stringify(document).toLowerCase().includes(query)
    );
  }, [data, search]);

  const total = data?.count ?? 0;
  const from = total ? skip + 1 : 0;
  const to = Math.min(total, skip + documents.length);
  const canPrev = skip > 0;
  const canNext = skip + PAGE_SIZE < total;

  return (
    <>
      <PageHeader
        title="Database"
        description="Read-only inspection of every collection behind the shop."
        actions={
          <>
            <Button variant="outline" onClick={refreshIndex} disabled={indexLoading}>
              <RefreshCw className={indexLoading ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportAll} loading={exporting}>
              <Download className="size-4" />
              Export JSON
            </Button>
          </>
        }
      />

      {indexError ? (
        <Notice
          tone="danger"
          title="Could not reach the database"
          action={
            <Button variant="outline" size="sm" onClick={refreshIndex}>
              Retry
            </Button>
          }
        >
          {indexError}
        </Notice>
      ) : null}

      {indexLoading && !index ? (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Card className="self-start">
            <CardHeader
              title="Collections"
              description={
                index?.generatedAt ? `Updated ${formatDateTime(index.generatedAt)}` : undefined
              }
            />
            <ul className="flex flex-col p-2">
              {(index?.collections ?? []).map((collection) => {
                const selected = collection.name === table;
                return (
                  <li key={collection.name}>
                    <button
                      type="button"
                      onClick={() => selectTable(collection.name)}
                      aria-current={selected ? "true" : undefined}
                      className={
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors duration-150 " +
                        (selected
                          ? "bg-brand-soft font-semibold text-brand"
                          : "text-muted-foreground hover:bg-surface-muted hover:text-foreground")
                      }
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Table2 className="size-4 flex-none" />
                        <span className="truncate">{collection.name}</span>
                      </span>
                      <span className="flex-none text-xs tabular-nums">
                        {formatNumber(collection.count)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {index && !index.collections.length ? (
                <li className="px-3 py-4 text-sm text-muted-foreground">
                  No collections reported.
                </li>
              ) : null}
            </ul>
          </Card>

          <Card className="min-w-0">
            <CardHeader
              title={table ? `${table} collection` : "Select a collection"}
              description={
                table
                  ? `${formatNumber(total)} document${total === 1 ? "" : "s"} total`
                  : "Choose a table on the left to inspect its documents."
              }
              actions={
                table ? (
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Filter rows…"
                    className="w-48"
                  />
                ) : null
              }
            />

            {dataError ? (
              <div className="p-5">
                <Notice tone="warning" title="Could not load this collection">
                  {dataError}
                </Notice>
              </div>
            ) : dataLoading && !documents.length ? (
              <div className="flex flex-col gap-2 p-5">
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <Skeleton key={rowIndex} className="h-10" />
                ))}
              </div>
            ) : visibleDocuments.length ? (
              <>
                <TableWrapper>
                  <Table>
                    <THead>
                      <TR className="hover:bg-transparent">
                        {columns.map((column) => (
                          <TH key={column}>{column}</TH>
                        ))}
                      </TR>
                    </THead>
                    <TBody>
                      {visibleDocuments.map((document, rowIndex) => (
                        <TR key={String(document._id ?? rowIndex)}>
                          {columns.map((column) => (
                            <TD key={column} className="max-w-72 align-top">
                              <CellValue value={document[column]} />
                            </TD>
                          ))}
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrapper>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {search ? (
                      <>
                        Showing{" "}
                        <span className="font-semibold text-foreground">
                          {visibleDocuments.length}
                        </span>{" "}
                        filtered row{visibleDocuments.length === 1 ? "" : "s"} on this page
                      </>
                    ) : (
                      <>
                        Showing{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {from}–{to}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatNumber(total)}
                        </span>
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canPrev || dataLoading}
                      onClick={() => changePage(skip - PAGE_SIZE)}
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canNext || dataLoading}
                      onClick={() => changePage(skip + PAGE_SIZE)}
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Database className="size-5" />}
                title={
                  documents.length ? "No rows match the filter" : "This collection is empty"
                }
                description={
                  documents.length
                    ? "Clear the filter to see every row on this page."
                    : "Documents created through the app will show up here."
                }
              />
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-faint-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return <Badge tone={value ? "success" : "neutral"}>{String(value)}</Badge>;
  }
  if (typeof value === "number") {
    return <span className="tabular-nums">{formatNumber(value, 2)}</span>;
  }
  if (typeof value === "string") {
    const isDate = /^\d{4}-\d{2}-\d{2}T/.test(value);
    if (isDate) {
      return (
        <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(value)}</span>
      );
    }
    return (
      <span className="block max-w-72 truncate" title={value}>
        {value}
      </span>
    );
  }
  const json = JSON.stringify(value);
  return (
    <code className="block max-w-72 truncate font-mono text-xs text-muted-foreground" title={json}>
      {json}
    </code>
  );
}
