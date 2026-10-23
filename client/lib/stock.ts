/**
 *public stock-photo helpers (Unsplash & Pexels) shared by the
 * /api/images/* proxy routes. Keys live in env only — the browser talks to
 * our own routes, so the secrets never reach the client.
 */

export interface StockPhoto {
  id: string;
  /** Aspect ratio (width / height) for masonry layout. */
  ratio: number;
  /** Raw sandbox-host image, suitable for the next/image optimizer. */
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
  /** Dominant colour for placeholders. */
  color: string;
}

export interface SetupInfo {
  setup: true;
  message: string;
  keyUrl: string;
  docsUrl: string;
}

export function missingKeyResponse(provider: string, keyUrl: string, docsUrl: string): Response {  return Response.json(
    {
      setup: true,
      message: `${provider} needs a free access key before searching works.`,
      keyUrl,
      docsUrl,
    } satisfies SetupInfo,
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

/* ------------------------------------------------------------------ */
/* Unsplash                                                            */
/* ------------------------------------------------------------------ */

const UNSPLASH_BASE = "https://api.unsplash.com";

function unsplashKey(): string {
  // `UNSPLASH_KEY` is the configured name; older names stay honoured.
  return (
    process.env.UNSPLASH_KEY?.trim() ||
    process.env.UNSPLASH_ACCESS_KEY?.trim() ||
    process.env.UNSPLASH_API_KEY?.trim() ||
    ""
  );
}

interface UnsplashRawPhoto {
  id: string;
  width: number;
  height: number;
  color?: string;
  alt_description?: string | null;
  description?: string | null;
  urls: { raw?: string; full?: string; regular?: string; small?: string; thumb?: string };
  user?: { name?: string; links?: { html?: string } };
  links?: { html?: string; download?: string };
}

export function isUnsplashConfigured(): boolean {
  return Boolean(unsplashKey());
}

export async function searchUnsplash(
  query: string,
  page: number,
  perPage: number
): Promise<{ photos: StockPhoto[]; total: number }> {
  const key = unsplashKey();
  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
  });
  const response = await fetch(`${UNSPLASH_BASE}/search/photos?${params.toString()}`, {
    headers: { Authorization: `Client-ID ${key}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("The Unsplash key was rejected — re-check UNSPLASH_KEY.");
  }
  if (response.status === 429) {
    throw new Error("The free Unsplash limit (50 requests/hour) is used up — try again later.");
  }
  if (!response.ok) {
    throw new Error(`Unsplash responded with HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as {
    total?: number;
    results?: UnsplashRawPhoto[];
  };

  const photos: StockPhoto[] = (payload.results ?? []).map((raw) => ({
    id: raw.id,
    ratio: raw.width && raw.height ? raw.width / raw.height : 1,
    image: raw.urls.regular ?? raw.urls.raw ?? "",
    imageThumb: raw.urls.small ?? raw.urls.thumb ?? raw.urls.regular ?? "",
    imageLarge: raw.urls.full ?? raw.urls.regular ?? "",
    width: raw.width,
    height: raw.height,
    alt: raw.alt_description || raw.description || query,
    author: raw.user?.name ?? "Unknown photographer",
    authorUrl: raw.user?.links?.html ?? "",
    pageUrl: raw.links?.html ?? "",
    downloadUrl: raw.links?.download ?? "",
    color: raw.color || "#7c6b60",
  }));

  return { photos, total: payload.total ?? photos.length };
}
