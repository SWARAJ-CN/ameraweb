export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Server-side proxy for the key-less background remover
 * (`BGREMOVE_API_URL`, default https://bgninja.com/api/remove — no account,
 * no key, daily no-cost limit enforced per network by the provider).
 *
 * Accepts either a multipart `file` field or an `imageUrl` field (e.g. a
 * photo picked from the Unsplash / Pexels tab) plus optional `bg` hex colour
 * ("ffffff" composites onto white; omit for a transparent PNG).
 * Responds with the transparent PNG bytes directly.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send a multipart form with a `file` or `imageUrl` field." }, {
      status: 400,
    });
  }

  const bg = String(form.get("bg") ?? "").trim();
  const fileField = form.get("file");
  const imageUrlField = String(form.get("imageUrl") ?? "").trim();

  let blob: Blob | null =
    fileField instanceof Blob && fileField.size > 0 ? fileField : null;

  if (!blob && imageUrlField) {
    try {
      const response = await fetch(imageUrlField, {
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "AmareHandmades-Admin/1.0" },
      });
      if (!response.ok) {
        return Response.json(
          { error: `Could not fetch that image URL (HTTP ${response.status}).` },
          { status: 400 }
        );
      }
      blob = await response.blob();
    } catch {
      return Response.json({ error: "Could not reach that image URL." }, { status: 400 });
    }
  }

  if (!blob) {
    return Response.json(
      { error: "Pick a photo or paste an image URL first." },
      { status: 400 }
    );
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: "That photo is larger than 25 MB — try a smaller one." },
      { status: 413 }
    );
  }

  const endpoint =
    process.env.BGREMOVE_API_URL?.trim() || "https://bgninja.com/api/remove";
  const upstreamForm = new FormData();
  // Keep the original filename when one came with the upload.
  const filename =
    fileField instanceof File && fileField.name ? fileField.name : "input.jpg";
  upstreamForm.append("file", blob, filename);
  if (bg && /^[0-9a-fA-F]{6}$/.test(bg.replace(/^#/, ""))) {
    upstreamForm.append("bg", bg.replace(/^#/, ""));
  }
  upstreamForm.append("src", "amare-handmades-admin");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: upstreamForm,
      signal: AbortSignal.timeout(110_000),
    });

    if (!response.ok) {
      const detail = await response
        .json()
        .then((payload: { error?: string; detail?: string }) =>
          payload.error ?? payload.detail ?? null
        )
        .catch(() => null);
      const statusMap: Record<number, string> = {
        402: "The remover's free daily quota is used up — try again tomorrow.",
        413: "That photo is too large for the remover (max 99 MB / 30 MP).",
        429: "Two removals are already running for this network — wait a moment.",
      };
      return Response.json(
        {
          error:
            statusMap[response.status] ??
            detail ??
            `The background remover responded with HTTP ${response.status}.`,
        },
        { status: response.status === 400 ? 400 : 502 }
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      return Response.json({ error: "The remover returned an empty image." }, { status: 502 });
    }
    return new Response(buffer, {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "The background remover is unreachable right now — try again shortly." },
      { status: 502 }
    );
  }
}
