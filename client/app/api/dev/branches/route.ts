import { createBranch, githubErrorResponse, listBranches } from "@/lib/github";
import { requireAuth } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  try {
    return Response.json(await listBranches());
  } catch (error) {
    return githubErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  let body: { name?: string; from?: string };
  try {
    body = (await request.json()) as { name?: string; from?: string };
  } catch {
    return Response.json({ error: "A JSON body is required." }, { status: 400 });
  }

  try {
    return Response.json(await createBranch(String(body.name ?? ""), String(body.from ?? "main")));
  } catch (error) {
    return githubErrorResponse(error);
  }
}
