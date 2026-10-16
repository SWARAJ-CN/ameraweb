import { createPull, githubErrorResponse, listPulls } from "@/lib/github";
import { requireAuth } from "@/lib/dev-auth";
import type { DevPullInput } from "@/lib/dev-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  const state = new URL(request.url).searchParams.get("state");
  const normalized = state === "closed" || state === "all" ? state : "open";
  try {
    return Response.json(await listPulls(normalized));
  } catch (error) {
    return githubErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  let body: DevPullInput;
  try {
    body = (await request.json()) as DevPullInput;
  } catch {
    return Response.json({ error: "A JSON body is required." }, { status: 400 });
  }

  try {
    return Response.json(
      await createPull({
        title: String(body.title ?? ""),
        head: String(body.head ?? ""),
        base: String(body.base ?? "main"),
        body: body.body ? String(body.body) : "",
        draft: Boolean(body.draft),
      })
    );
  } catch (error) {
    return githubErrorResponse(error);
  }
}
