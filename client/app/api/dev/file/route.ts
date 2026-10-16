import { getFile, githubErrorResponse } from "@/lib/github";
import { requireAuth } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  const params = new URL(request.url).searchParams;
  const path = params.get("path")?.trim();
  const branch = params.get("branch")?.trim();
  if (!path || !branch) {
    return Response.json({ error: "Both path and branch are required." }, { status: 400 });
  }
  try {
    return Response.json(await getFile(path, branch));
  } catch (error) {
    return githubErrorResponse(error);
  }
}
