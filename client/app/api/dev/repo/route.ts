import { getRepo, githubErrorResponse } from "@/lib/github";
import { requireAuth } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  try {
    return Response.json(await getRepo());
  } catch (error) {
    return githubErrorResponse(error);
  }
}
