"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  Music,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import { Pagination, PageHeader, SearchInput, SegmentedControl } from "@/components/ui/Controls";
import { Switch } from "@/components/ui/Switch";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, Notice, Skeleton, Spinner } from "@/components/ui/Feedback";
import { Waveform } from "@/components/features/music/Waveform";
import { useMusicPlayer } from "@/components/providers/MusicPlayerProvider";
import { cn } from "@/lib/cn";
import type { Song } from "@/lib/saavn";

/**
 * Curated playlists shown as cover cards on top. A playlist may span several
 * catalogue queries — the Malayalam & Tamil opener mixes two regional lists
 * so the section opens with South-Indian music by default.
 */
interface Playlist {
  label: string;
  queries: string[];
  hint: string;
  tone: string;
}

const PLAYLISTS: Playlist[] = [
  {
    label: "Malayalam & Tamil",
    queries: ["malayalam songs", "tamil songs"],
    hint: "Kerala meets Kollywood",
    tone: "var(--chart-3)",
  },
  {
    label: "Trending now",
    queries: ["trending songs"],
    hint: "What everyone plays today",
    tone: "var(--chart-1)",
  },
  {
    label: "Work loop",
    queries: ["work loop songs"],
    hint: "Steady beats for long shifts",
    tone: "var(--chart-2)",
  },
  {
    label: "Lo-fi beats",
    queries: ["lofi love"],
    hint: "Slow it down, stay in flow",
    tone: "var(--chart-5)",
  },
  {
    label: "Evergreen Hindi",
    queries: ["old is gold hindi"],
    hint: "Timeless melodies",
    tone: "var(--chart-4)",
  },
  {
    label: "English hits",
    queries: ["top english hits"],
    hint: "Pop, rock & everything loud",
    tone: "var(--chart-6)",
  },
];

const PAGE_SIZE = 30;
/** Pages per query per batch; doubled for two-query playlists to cross 100+ tracks. */
function pagesPerBatch(playlist: Playlist): number {
  return playlist.queries.length > 1 ? 3 : 5;
}

type ViewMode = "small" | "large" | "list";

const VIEW_OPTIONS = [
  { value: "small", label: "Compact grid" },
  { value: "large", label: "Large grid" },
  { value: "list", label: "List" },
] as const;

const GRID_COLS: Record<Exclude<ViewMode, "list">, string> = {
  small: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6",
  large: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
};

const IMAGE_SIZES: Record<ViewMode, string> = {
  small: "(min-width:1024px) 13vw, (min-width:640px) 22vw, 30vw",
  large: "(min-width:1280px) 24vw, (min-width:640px) 30vw, 50vw",
  list: "56px",
};

interface Library {
  /** The term|attempt combo this chunk belongs to. */
  termKey: string;
  songs: Song[];
  total: number;
  /** True when a batch produced nothing new — pagination is pointless then. */
  drained: boolean;
}

type PagePayload = { songs?: Song[]; total?: number };
type PageResult = PagePayload | { error: string } | null;

/* Grace-son mode external store: persisted in localStorage, readable on the
   first client render, stays false during SSR/hydration. */
const GRACE_STORAGE_KEY = "music:graceSon";
const graceListeners = new Set<() => void>();
function readGrace(): boolean {
  try {
    return localStorage.getItem(GRACE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function subscribeGrace(callback: () => void): () => void {
  graceListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    graceListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
function writeGrace(on: boolean): void {
  try {
    localStorage.setItem(GRACE_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // storage unavailable — still notify for this session
  }
  graceListeners.forEach((listener) => listener());
}

export default function MusicPage() {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState<string>(PLAYLISTS[0].label);
  const [batch, setBatch] = useState(0);
  /** Bumped by "Retry" to force a refetch without changing the query. */
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<ViewMode>("small");

  /** Cover images for the playlist cards, fetched once on mount. */
  const [covers, setCovers] = useState<Record<string, string>>({});

  const [library, setLibrary] = useState<Library>({
    termKey: "",
    songs: [],
    total: 0,
    drained: false,
  });
  const [error, setError] = useState<string | null>(null);

  const graceMode = useSyncExternalStore(subscribeGrace, readGrace, () => false);
  /**
   * Grace-son mode: strip everything down to a single non-stop Tamil stream —
   * no playlist cards, no search box, unlimited pagination through the Tamil
   * catalogue only. Persisted through the external store so it survives
   * reloads and never hydrates wrong.
   */
  const toggleGraceMode = (on: boolean) => {
    writeGrace(on);
    setBatch(0);
    if (on) setInput("");
  };

  // Playback state is app-wide — provided by the shell's MusicPlayerProvider
  // so the queue keeps playing across tab switches and in background tabs.
  const {
    queue,
    index,
    playing,
    visualizerReady,
    getAnalyser,
    startQueue,
  } = useMusicPlayer();

  const basePlaylist = useMemo(
    () => PLAYLISTS.find((candidate) => candidate.label === term) ?? PLAYLISTS[0],
    [term]
  );
  // In Grace-son mode the whole catalogue collapses to one query: Tamil.
  const playlist = useMemo(
    () =>
      graceMode
        ? {
            ...basePlaylist,
            label: "Tamil · Grace son",
            queries: ["tamil songs"],
          }
        : basePlaylist,
    [basePlaylist, graceMode]
  );
  const pagesPer = pagesPerBatch(playlist);
  const pageSize = PAGE_SIZE * pagesPer * playlist.queries.length;

  const requestKey = `${graceMode ? "grace" : term}|${batch}|${attempt}`;
  const termKey = `${graceMode ? "grace" : term}|${attempt}`;
  const [loadedKey, setLoadedKey] = useState("");
  const fetching = loadedKey !== requestKey;

  const requestRef = useRef(0);

  const activeId = queue[index]?.id ?? null;

  // Debounced search — clearing the box falls back to the default playlist so
  // the section always shows something.
  useEffect(() => {
    const value = input.trim();
    const timer = setTimeout(() => {
      if (value.length >= 2) {
        setTerm(value);
        setBatch(0);
      } else if (!value) {
        setTerm(PLAYLISTS[0].label);
        setBatch(0);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [input]);

  // Playlist card covers: one quiet search per playlist, first artwork wins.
  useEffect(() => {
    let cancelled = false;
    for (const candidate of PLAYLISTS) {
      const params = new URLSearchParams({
        q: candidate.queries[0],
        page: "1",
        limit: "1",
      });
      fetch(`/api/music/search?${params.toString()}`)
        .then((response) => response.json())
        .then((payload: { songs?: Song[] } | null) => {
          if (cancelled) return;
          const image = payload?.songs?.[0]?.image;
          if (image) {
            setCovers((prev) =>
              prev[candidate.label] ? prev : { ...prev, [candidate.label]: image }
            );
          }
        })
        .catch(() => {
          // A missing cover just means the card falls back to its tone block.
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const controller = new AbortController();
    const firstPage = batch * pagesPer + 1;
    const combos = playlist.queries.flatMap((query) =>
      Array.from({ length: pagesPer }, (_, i) => ({ query, page: firstPage + i }))
    );

    const fetchPage = (query: string, page: number): Promise<PageResult> => {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      return fetch(`/api/music/search?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | (PagePayload & { error?: string })
            | null;
          if (!response.ok) return { error: payload?.error ?? "Search failed." };
          return payload ?? { error: "Empty response." };
        })
        .catch((cause: unknown) => {
          if (cause instanceof Error && cause.name === "AbortError") throw cause;
          // One flaky page must not sink the whole batch.
          return { error: cause instanceof Error ? cause.message : "Search failed." };
        });
    };

    // Pages load in parallel; failed ones simply contribute no tracks.
    Promise.all(combos.map(({ query, page }) => fetchPage(query, page)))
      .then((responses) => {
        if (requestRef.current !== requestId) return;
        const usableByQuery = new Map<string, Song[]>();
        const seen = new Set<string>();
        let failure: string | null = null;

        responses.forEach((response, position) => {
          if (!response) return;
          if ("error" in response) {
            failure ??= response.error;
            return;
          }
          const query = combos[position].query;
          const list = usableByQuery.get(query) ?? [];
          for (const song of response.songs ?? []) {
            if (!seen.has(song.id)) {
              seen.add(song.id);
              list.push(song);
            }
          }
          usableByQuery.set(query, list);
        });

        if (usableByQuery.size === 0) {
          throw new Error(failure ?? "Search failed.");
        }

        // Interleave playlists' queries (Malayalam ⇄ Tamil …) so every batch
        // feels mixed rather than two solid blocks.
        const fresh: Song[] = [];
        let added = true;
        while (added) {
          added = false;
          for (const query of playlist.queries) {
            const next = usableByQuery.get(query)?.shift();
            if (next) {
              fresh.push(next);
              added = true;
            }
          }
        }

        const total = responses.reduce(
          (sum, response) =>
            response && "total" in response && typeof response.total === "number"
              ? Math.max(sum, response.total)
              : sum,
          0
        );

        setLibrary((prev) =>
          prev.termKey === termKey
            ? {
                ...prev,
                songs: mergeUnique(prev.songs, fresh),
                total: total || prev.total,
                drained: drainedNoNew(prev.songs, fresh),
              }
            : { termKey, songs: fresh, total, drained: fresh.length === 0 }
        );
        setLoadedKey(requestKey);
      })
      .catch((cause: unknown) => {
        if (requestRef.current !== requestId) return;
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Search failed.");
        setLoadedKey(requestKey);
      });

    return () => controller.abort();
    // `library` is intentionally not a dependency: merges read-and-write via
    // the setState updater, and watching it would refetch on every merge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termKey, batch]);

  const songs = library.termKey === termKey ? library.songs : [];
  const initialLoading = fetching && library.termKey === "";
  const pageCount = Math.max(1, Math.ceil(library.total / pageSize));
  const isPlaylist = PLAYLISTS.some((candidate) => candidate.label === term);

  /** Live bars with a CSS mimic fallback where CORS blocks the analyser. */
  const renderWave = (className: string, tone: string) => (
    <span className={cn("grid place-items-center p-1", className)}>
      {visualizerReady ? (
        <Waveform
          getAnalyser={getAnalyser}
          active={playing}
          className={cn("h-full w-full", tone)}
        />
      ) : (
        <span className={cn("eq", tone)}>
          <span />
          <span />
          <span />
        </span>
      )}
    </span>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Music"
        description={
          graceMode
            ? "Grace-son mode — one endless stream of Tamil songs, nothing else."
            : "Playlists, search and a listening bar with your own equalizer — made for the studio."
        }
        actions={
          <div className="flex items-center gap-3">
            <SearchInput
              value={input}
              onChange={setInput}
              placeholder="Search songs, artists or albums…"
              className={cn("w-full sm:w-80", graceMode && "hidden")}
            />
            <label
              title="Only Tamil songs, unlimited — hides playlists and search"
              className="flex cursor-pointer select-none items-center gap-2 rounded-full border border-separator bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors has-[button[aria-checked=true]]:border-accent/40 has-[button[aria-checked=true]]:bg-accent-soft has-[button[aria-checked=true]]:text-brand"
            >
              <Switch
                checked={graceMode}
                onChange={toggleGraceMode}
                aria-label="Grace-son mode"
              />
              <span className={cn(graceMode && "text-brand")}>Grace son mode</span>
              <Sparkles className={cn("size-3.5", graceMode ? "text-brand" : "text-faint-foreground")} />
            </label>
          </div>
        }
      />

      {/* Playlist grid — square cover cards with a hover play affordance.
          Hidden in Grace-son mode: Tamil only, no choices. */}
      <div
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6",
          graceMode && "hidden"
        )}
      >
        {PLAYLISTS.map((candidate) => {
          const active = candidate.label === term;
          return (
            <button
              key={candidate.label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setInput("");
                setTerm(candidate.label);
                setBatch(0);
              }}
              className={cn(
                "group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border text-start shadow-field transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop",
                active
                  ? "border-transparent ring-2 ring-accent ring-offset-2 ring-offset-background"
                  : "border-separator"
              )}
            >
              {covers[candidate.label] ? (
                <Image
                  src={covers[candidate.label]}
                  alt=""
                  width={352}
                  height={352}
                  sizes="(min-width:1024px) 14vw, (min-width:640px) 30vw, 45vw"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <span
                  className="absolute inset-0 grid place-items-center text-black/50"
                  style={{ backgroundColor: candidate.tone }}
                >
                  <Music className="size-8" />
                </span>
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              {/* Play affordance appears on hover / stays for the active card */}
              <span
                className={cn(
                  "absolute end-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white text-black shadow-field transition-all duration-200",
                  active
                    ? "opacity-100"
                    : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                )}
              >
                {active && playing ? (
                  <span className="eq text-black">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <Play className="size-4 fill-black" />
                )}
              </span>
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className="block truncate text-sm font-bold text-white drop-shadow">
                  {candidate.label}
                </span>
                <span className="block truncate text-[11px] text-white/80">{candidate.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-3">
        <p className="text-xs font-medium text-muted">
          {graceMode && isPlaylist ? "Tamil stream" : isPlaylist ? "Playlist" : "Search results"}
        </p>
        <SegmentedControl
          options={[...VIEW_OPTIONS]}
          value={view}
          onChange={(value) => setView(value as ViewMode)}
          ariaLabel="Library view"
        />
      </div>

      {error ? (
        <Notice
          tone="warning"
          title="Music search is unavailable"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Notice>
      ) : null}

      <Card>
        <CardHeader
          title={graceMode ? playlist.label : term}
          description={
            initialLoading
              ? "Loading tracks…"
              : pageCount > 1
                ? `${library.total.toLocaleString("en-IN")} tracks · page ${batch + 1} of ${pageCount}`
                : `${library.total.toLocaleString("en-IN")} tracks`
          }
          actions={fetching ? <Spinner className="size-4" /> : null}
        />
        {initialLoading ? (
          <CardContent
            className={cn("grid gap-3", view === "list" ? "grid-cols-1" : GRID_COLS[view])}
          >
            {Array.from({ length: view === "large" ? 6 : 12 }).map((_, tileIndex) =>
              view === "list" ? (
                <Skeleton key={tileIndex} className="h-16 rounded-lg" />
              ) : (
                <div key={tileIndex} className="flex flex-col gap-2.5">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              )
            )}
          </CardContent>
        ) : songs.length ? (
          <CardContent
            className={cn(
              view === "list" ? "flex flex-col gap-1" : cn("grid gap-3", GRID_COLS[view])
            )}
          >
            {songs.map((song, songIndex) => {
              const active = song.id === activeId;
              if (view === "list") {
                return (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => startQueue(songs, term, songIndex)}
                    aria-label={`Play ${song.title} by ${song.artist}`}
                    className={cn(
                      "group flex min-h-16 items-center gap-3 rounded-field p-2 text-start transition-colors duration-150 hover:bg-surface-secondary active:bg-surface-secondary",
                      active && "bg-accent-soft"
                    )}
                  >
                    <span className="relative size-12 flex-none overflow-hidden rounded-lg bg-surface-muted sm:size-14">
                      {song.image ? (
                        <Image
                          src={song.image}
                          alt=""
                          width={112}
                          height={112}
                          sizes={IMAGE_SIZES.list}
                          className="inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full place-items-center text-faint-foreground">
                          <Music className="size-4" />
                        </span>
                      )}
                      {active && playing ? (
                        renderWave("absolute inset-0", "text-white")
                      ) : (
                        <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <Play className="size-4 fill-white text-white" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm font-semibold",
                          active ? "text-brand" : "text-foreground"
                        )}
                      >
                        {song.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {song.artist}
                        {song.album ? ` · ${song.album}` : ""}
                      </span>
                    </span>
                    {active ? (
                      <span className="hidden h-6 w-24 shrink-0 sm:block">
                        {renderWave("h-full w-full", "text-brand")}
                      </span>
                    ) : null}
                    <span className="flex-none text-xs font-medium tabular-nums text-muted-foreground">
                      {formatSeconds(song.duration)}
                    </span>
                  </button>
                );
              }

              const cover = view === "large" ? 500 : 300;
              return (
                <div key={song.id} className="group relative flex flex-col gap-2.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startQueue(songs, term, songIndex)}
                    aria-label={`Play ${song.title} by ${song.artist}`}
                    className="relative aspect-square h-auto w-full overflow-hidden rounded-lg p-0 shadow-field transition-transform duration-300 hover:scale-[1.02]"
                  >
                    {song.image ? (
                      <Image
                        src={song.image}
                        alt=""
                        width={cover}
                        height={cover}
                        sizes={IMAGE_SIZES[view]}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <Music className="size-7 text-faint-foreground" />
                    )}
                    <span
                      className={cn(
                        "absolute inset-0 grid place-items-center bg-black/45 transition-opacity duration-200",
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      {active && playing ? (
                        renderWave("h-2/3 w-2/3", "text-white")
                      ) : (
                        <Play className="size-5 fill-white text-white sm:size-7" />
                      )}
                    </span>
                    {view === "large" ? (
                      <span className="pointer-events-none absolute end-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                        {formatSeconds(song.duration)}
                      </span>
                    ) : null}
                  </Button>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold",
                        active ? "text-brand" : "text-foreground",
                        view === "small" && "text-xs sm:text-sm"
                      )}
                    >
                      {song.title}
                    </p>
                    <p className="truncate text-xs text-muted" title={song.artist}>
                      {song.artist}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        ) : (
          <CardContent>
            <EmptyState
              icon={<Search className="size-5" />}
              title="Nothing matched that search"
              description="Try a shorter phrase, an artist name, or one of the playlists above."
            />
          </CardContent>
        )}
      </Card>

      {/* Numbered pages: 1 · 2 · 3 … next — each page appends another batch. */}
      {pageCount > 1 && songs.length ? (
        <Pagination
          page={batch + 1}
          pageCount={pageCount}
          total={library.total}
          pageSize={pageSize}
          onChange={(page) => setBatch(page - 1)}
        />
      ) : null}

      <footer className="text-center text-[11px] text-faint-foreground">
        All music belongs to the respective labels · played here for private
        listening
      </footer>
    </div>
  );
}

function mergeUnique(existing: Song[], incoming: Song[]): Song[] {
  const seen = new Set(existing.map((song) => song.id));
  const merged = [...existing];
  for (const song of incoming) {
    if (!seen.has(song.id)) {
      seen.add(song.id);
      merged.push(song);
    }
  }
  return merged;
}

/** A batch only "drains" the catalogue when it adds nothing new. */
function drainedNoNew(existing: Song[], incoming: Song[]): boolean {
  if (incoming.length === 0) return true;
  const seen = new Set(existing.map((song) => song.id));
  return incoming.every((song) => seen.has(song.id));
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
