"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download,
  ExternalLink,
  KeyRound,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Pagination, PageHeader, SearchInput, SegmentedControl } from "@/components/ui/Controls";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState, Notice, Skeleton, Spinner } from "@/components/ui/Feedback";
import { ImageStudio } from "@/components/features/studio/ImageStudio";
import { cn } from "@/lib/cn";

type InnerTab = "unsplash" | "edit" | "bgremove";

const INNER_OPTIONS = [
  { value: "unsplash", label: "Photos" },
  { value: "edit", label: "Editor" },
  { value: "bgremove", label: "Bg Remove" },
] as const;

interface StockPhoto {
  id: string;
  ratio: number;
  image: string;
  imageThumb: string;
  imageLarge: string;
  width: number;
  height: number;
  alt: string;
  author: string;
  authorUrl: string;
  pageUrl: string;
  downloadUrl: string;
  color: string;
}

interface SearchPayload {
  photos?: StockPhoto[];
  total?: number;
  error?: string;
  setup?: boolean;
  message?: string;
  keyUrl?: string;
  docsUrl?: string;
}

export default function PublicApisPage() {
  const [tab, setTab] = useState<InnerTab>("unsplash");
  // A photo handed over from Bg Remove opens directly in the Editor tab.
  const [editorSource, setEditorSource] = useState<string | null>(null);
  const clearEditorSource = useCallback(() => setEditorSource(null), []);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tools"
        description="Pretty visuals for your designs — frame previews, floral backgrounds and clean portrait cutouts."
        actions={
          <SegmentedControl
            options={[...INNER_OPTIONS]}
            value={tab}
            onChange={(value) => setTab(value as InnerTab)}
            ariaLabel="Tool tab"
          />
        }
      />
      {tab === "unsplash" ? <UnsplashTab /> : null}
      {tab === "edit" ? (
        <ImageStudio externalSource={editorSource} onClearExternal={clearEditorSource} />
      ) : null}
      {tab === "bgremove" ? (
        <BgRemoveTab
          onSendToEditor={(url) => {
            setEditorSource(url);
            setTab("edit");
          }}
        />
      ) : null}
      <footer className="text-center text-[11px] text-faint-foreground">
        Photos stay the property of their creators · used here for frame
        previews and designs
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared masonry grid for photo results                               */
/* ------------------------------------------------------------------ */

function PhotoGrid({ photos }: { photos: StockPhoto[] }) {
  return (
    <div className="columns-2 gap-2.5 sm:columns-3 lg:columns-4 xl:columns-5 [&>*]:mb-2.5">
      {photos.map((photo) => (
        <a
          key={photo.id}
          href={photo.downloadUrl ?? photo.pageUrl}
          target="_blank"
          rel="noreferrer"
          title={`${photo.alt} — open in full size`}
          className="group relative block break-inside-avoid overflow-hidden rounded-field border border-separator bg-surface-muted shadow-field transition-shadow hover:shadow-pop"
        >
          <Image
            src={photo.imageThumb}
            alt={photo.alt}
            width={Math.min(photo.width || 600, 600)}
            height={Math.round(Math.min(photo.width || 600, 600) / (photo.ratio || 1))}
            unoptimized
            sizes="(min-width:1280px) 18vw, (min-width:640px) 30vw, 45vw"
            className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="min-w-0 truncate text-[10px] font-medium text-white">
              {photo.author}
            </span>
            <Download className="size-3.5 flex-none text-white" />
          </span>
        </a>
      ))}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="columns-2 gap-2.5 sm:columns-3 lg:columns-4 xl:columns-5 [&>*]:mb-2.5">
      {[0.7, 1.2, 0.85, 1.5, 1, 0.75, 1.3, 0.9, 1.1, 0.8, 1.4, 1.05].map((ratio, index) => (
        <div key={index} className="break-inside-avoid">
          <Skeleton className="w-full rounded-field" style={{ aspectRatio: ratio || 1 }} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Unsplash tab                                                        */
/* ------------------------------------------------------------------ */

const UNSPLASH_SUGGESTIONS = [
  "nature",
  "wedding",
  "flowers",
  "couples",
  "landscape",
  "aesthetic",
];

function UnsplashTab() {
  return (
    <StockSearchTab
      tabKey="unsplash"
      provider="Unsplash"
      suggestions={UNSPLASH_SUGGESTIONS}
      keyUrl="https://unsplash.com/oauth/applications"
      docsUrl="https://unsplash.com/developers"
      quotaText="Free demo quota: 50 requests/hour (resets hourly)."
      setupHelp="Create a free developer app at unsplash.com/developers, copy the Access Key, and add it to the client/.env file as: UNSPLASH_ACCESS_KEY=your_key — then restart the dev server."
    />
  );
}

/* ------------------------------------------------------------------ */
/* Stock search tab — Unsplash                                          */
/* ------------------------------------------------------------------ */

interface StockState {
  termKey: string;
  photos: StockPhoto[];
  total: number;
}

function StockSearchTab({
  tabKey,
  provider,
  suggestions,
  keyUrl,
  docsUrl,
  quotaText,
  setupHelp,
}: {
  tabKey: "unsplash";
  provider: string;
  suggestions: string[];
  keyUrl: string;
  docsUrl: string;
  quotaText: string;
  setupHelp: string;
}) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState(suggestions[0]);
  const [batch, setBatch] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [library, setLibrary] = useState<StockState>({
    termKey: "",
    photos: [],
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ message: string; keyUrl: string; docsUrl: string } | null>(
    null
  );

  const PAGE_SIZE = 24;

  const requestKey = `${term}|${batch}|${attempt}`;
  const termKey = `${term}|${attempt}`;
  const [loadedKey, setLoadedKey] = useState("");
  const fetching = loadedKey !== requestKey;

  const requestRef = useRef(0);

  // Debounced search — clearing falls back to the first suggestion.
  useEffect(() => {
    const value = input.trim();
    if (value.length < 2) return;
    const timer = setTimeout(() => {
      setTerm(value);
      setBatch(0);
    }, 450);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();

    const params = new URLSearchParams({
      q: term,
      page: String(batch + 1),
      limit: String(PAGE_SIZE),
    });
    fetch(`/api/images/${tabKey}?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as SearchPayload | null;
        if (!payload) throw new Error("Empty response.");
        if (payload.setup) {
          setSetup({
            message: payload.message ?? `${provider} needs a key.`,
            keyUrl: payload.keyUrl ?? keyUrl,
            docsUrl: payload.docsUrl ?? docsUrl,
          });
          setLoadedKey(requestKey);
          return null;
        }
        setSetup(null);
        if (payload.error) throw new Error(payload.error);
        return payload;
      })
      .then((payload) => {
        if (!payload || requestRef.current !== requestId) return;
        setLibrary((prev) => {
          if (prev.termKey !== termKey) {
            return {
              termKey,
              photos: payload.photos ?? [],
              total: payload.total ?? 0,
            };
          }
          const merge = <T extends { id: string }>(existing: T[], incoming: T[]) => {
            const seen = new Set(existing.map((item) => item.id));
            return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
          };
          return {
            ...prev,
            photos: merge(prev.photos, payload.photos ?? []),
            total: Math.max(prev.total, payload.total ?? 0),
          };
        });
        setLoadedKey(requestKey);
      })
      .catch((cause: unknown) => {
        if (requestRef.current !== requestId) return;
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Search failed.");
        setLoadedKey(requestKey);
      });

    return () => controller.abort();
    // `library` merges happen via the setState updater; watching it would
    // refetch on every append.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termKey, batch]);

  const photos = library.termKey === termKey ? library.photos : [];
  const results = photos.length;
  const pageCount = Math.max(1, Math.ceil(library.total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      {setup ? (
        <Notice
          tone="warning"
          title={`${provider} needs a free access key`}
          action={
            <a
              href={setup.keyUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses("outline", "sm")}
            >
              <KeyRound className="size-3.5" /> Get the key
            </a>
          }
        >
          <p>{setupHelp}</p>
          <a
            href={setup.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand"
          >
            <ExternalLink className="size-3" /> Documentation
          </a>
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={input}
          onChange={(value) => {
            setInput(value);
            if (!value.trim()) {
              setTerm(suggestions[0]);
              setBatch(0);
            }
          }}
          placeholder={`Search ${provider}…`}
          className="w-full sm:w-80"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setInput("");
              setTerm(suggestion);
              setBatch(0);
            }}
            className={cn(
              "min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
              term === suggestion && !input.trim()
                ? "border-transparent bg-accent text-accent-foreground"
                : "border-separator bg-surface text-muted hover:text-foreground"
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {error ? (
        <Notice
          tone="warning"
          title={`${provider} search failed`}
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
          title={term}
          description={
            fetching
              ? "Loading…"
              : `${library.total.toLocaleString("en-IN")} photos · page ${batch + 1} of ${pageCount}`
          }
          actions={fetching ? <Spinner className="size-4" /> : null}
        />
        <CardContent className="pt-0">
          {fetching && results === 0 ? (
            <ResultsSkeleton />
          ) : results ? (
            <div className="flex flex-col gap-3">
              {photos.length ? <PhotoGrid photos={photos} /> : null}
            </div>
          ) : (
            <EmptyState
              icon={<Search className="size-5" />}
              title="Nothing matched that search"
              description="Try a different phrase or one of the suggestion chips."
            />
          )}
        </CardContent>
      </Card>

      {!fetching && results > 0 && pageCount > 1 ? (
        <Pagination
          page={batch + 1}
          pageCount={pageCount}
          total={library.total}
          pageSize={PAGE_SIZE}
          onChange={(page) => setBatch(page - 1)}
        />
      ) : null}

      <p className="text-[11px] text-faint-foreground">{quotaText}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bg Remove tab                                                       */
/* ------------------------------------------------------------------ */

const CHECKER_STYLE = {
  backgroundImage:
    "linear-gradient(45deg, var(--surface-secondary) 25%, transparent 25%, transparent 75%, var(--surface-secondary) 75%), linear-gradient(45deg, var(--surface-secondary) 25%, transparent 25%, transparent 75%, var(--surface-secondary) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 8px 8px",
} as const;

function BgRemoveTab({
  onSendToEditor,
}: {
  onSendToEditor: (url: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [bg, setBg] = useState<"transparent" | "white">("transparent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; source: string } | null>(null);
  const resultRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    },
    []
  );

  const run = useCallback(async () => {
    if (!file && !imageUrl.trim()) {
      setError("Pick a photo or paste an image URL first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const source = file ? URL.createObjectURL(file) : imageUrl.trim();
      const form = new FormData();
      if (file) form.append("file", file);
      else form.append("imageUrl", imageUrl.trim());
      if (bg === "white") form.append("bg", "ffffff");

      const response = await fetch("/api/images/bgremove", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `Removal failed (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      if (resultRef.current) URL.revokeObjectURL(resultRef.current);
      resultRef.current = URL.createObjectURL(blob);
      setResult({ url: resultRef.current, source });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Removal failed.");
    } finally {
      setBusy(false);
    }
  }, [file, imageUrl, bg]);

  return (
    <Card>
      <CardHeader
        title="Remove photo backgrounds"
        description="Cut portraits or product shots clean for frame previews — transparent PNG out."
        actions={busy ? <Spinner className="size-4" /> : null}
      />
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-h-12 flex-1 cursor-pointer flex-col justify-center gap-0.5 rounded-field border border-dashed border-separator bg-surface px-3.5 py-2.5 text-sm transition-colors hover:border-accent/50">
            <span className="flex items-center gap-2 font-medium">
              <Upload className="size-4 text-muted" />
              {file ? file.name : "Upload a photo (JPG, PNG, WEBP)…"}
            </span>
            <span className="text-xs text-faint-foreground">
              {file ? formatBytes(file.size) : "works great with portraits from the tabs above"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>
          <Button variant="secondary" size="lg" onClick={run} disabled={busy}>
            {busy ? (
              <>
                <Spinner className="size-4" /> Removing…
              </>
            ) : (
              <>
                <Scissors className="size-4" /> Remove background
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Output background
          </span>
          <SegmentedControl
            options={[
              { value: "transparent", label: "Transparent" },
              { value: "white", label: "White" },
            ]}
            value={bg}
            onChange={(value) => setBg(value as "transparent" | "white")}
            ariaLabel="Output background"
          />
        </div>

        {error ? (
          <Notice tone="warning" title="Removal failed">
            {error}
          </Notice>
        ) : null}

        <p className="text-[11px] text-faint-foreground">
          The remover is a free key-less service with a daily no-cost limit per
          network — portraits one at a time are plenty for frame previews.
          Photos are processed in memory and never stored.
        </p>

        {result ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <ResultBox
              title="Original"
              url={result.source}
              alt="Original photo"
            />
            <ResultBox
              title="Background removed"
              url={result.url}
              alt="Photo with the background removed"
              checker
              actions={
                <div className="flex gap-1.5">
                  <a
                    href={result.url}
                    download="amare-cutout.png"
                    className={buttonClasses("secondary", "sm")}
                  >
                    <Download className="size-3.5" /> PNG
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setImageUrl("");
                      setResult(null);
                      setError(null);
                    }}
                  >
                    <Trash2 className="size-3.5" /> Clear
                  </Button>
                </div>
              }
            />
          </div>
        ) : null}

        {result ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="md" onClick={() => onSendToEditor(result.url)}>
              <Sparkles className="size-4" /> Open in Editor
            </Button>
            <span className="text-xs text-muted">
              The cut-out opens in the Editor tab, ready for looks and story export.
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResultBox({
  title,
  url,
  alt,
  actions,
  checker,
}: {
  title: string;
  url: string;
  alt: string;
  actions?: ReactNode;
  checker?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-field border border-separator bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        {actions ?? null}
      </div>
      <div
        className="grid min-h-56 place-items-center overflow-hidden rounded-lg border border-separator bg-surface-muted"
        style={checker ? CHECKER_STYLE : undefined}
      >
        {url ? (
          <img src={url} alt={alt} className="max-h-72 w-auto max-w-full object-contain" />
        ) : (
          <span className="text-xs text-faint-foreground">No image</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
