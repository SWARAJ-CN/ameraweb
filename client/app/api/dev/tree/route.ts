import { getTree, githubErrorResponse } from "@/lib/github";
import { requireAuth } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  const branch = new URL(request.url).searchParams.get("branch")?.trim();
  if (!branch) {
    return Response.json({ error: "A branch is required." }, { status: 400 });
  }
  try {
    return Response.json(await getTree(branch));
  } catch (error) {
    return githubErrorResponse(error);
  }
}
