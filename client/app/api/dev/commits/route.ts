import { githubErrorResponse, listCommits } from "@/lib/github";
import { requireAuth } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  const params = new URL(request.url).searchParams;
  const branch = params.get("branch")?.trim() || "main";
  const perPage = Math.min(Math.max(Number(params.get("perPage")) || 25, 1), 100);

  try {
    return Response.json(await listCommits(branch, perPage));
  } catch (error) {
    return githubErrorResponse(error);
  }
}
