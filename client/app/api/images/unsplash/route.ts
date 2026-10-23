import {
  isUnsplashConfigured,
  missingKeyResponse,
  searchUnsplash,
} from "@/lib/stock";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;

function readInt(value: string | null, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Server-side proxy for the Unsplash photo library. The access key lives in
 * `UNSPLASH_ACCESS_KEY` and is never exposed to the browser; proxying also
 * sidesteps CORS. Free tier: 50 requests/hour on the demo quota.
 */
export async function GET(request: Request) {
  if (!isUnsplashConfigured()) {
    return missingKeyResponse(
      "Unsplash",
      "https://unsplash.com/oauth/applications",
      "https://unsplash.com/developers"
    );
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const pg = readInt(searchParams.get("page"), 1, 200, 1);
  const limit = readInt(searchParams.get("limit"), 1, MAX_LIMIT, DEFAULT_LIMIT);

  if (!query) {
    return Response.json({ error: "Give me something to search for." }, { status: 400 });
  }

  try {
    const { photos, total } = await searchUnsplash(query, pg, limit);
    return Response.json({ photos, total, page: pg, limit }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unsplash is unavailable right now." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
