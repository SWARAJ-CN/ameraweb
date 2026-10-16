import { githubErrorResponse, mergePull } from "@/lib/github";
import { requireAuth } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  let body: { number?: number; method?: string };
  try {
    body = (await request.json()) as { number?: number; method?: string };
  } catch {
    return Response.json({ error: "A JSON body is required." }, { status: 400 });
  }

  const number = Number(body.number);
  if (!Number.isInteger(number) || number <= 0) {
    return Response.json({ error: "A pull request number is required." }, { status: 400 });
  }

  const method = body.method === "squash" || body.method === "rebase" ? body.method : "merge";

  try {
    return Response.json(await mergePull(number, method));
  } catch (error) {
    return githubErrorResponse(error);
  }
}
