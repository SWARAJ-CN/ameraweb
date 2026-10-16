import { commitFiles, githubErrorResponse } from "@/lib/github";
import { requireAuth } from "@/lib/dev-auth";
import type { DevCommitInput } from "@/lib/dev-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("denied" in auth) return auth.denied;

  let body: DevCommitInput;
  try {
    body = (await request.json()) as DevCommitInput;
  } catch {
    return Response.json({ error: "A JSON body is required." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !Array.isArray(body.changes)) {
    return Response.json({ error: "The request is missing its changes." }, { status: 400 });
  }

  try {
    return Response.json(
      await commitFiles({
        branch: String(body.branch ?? ""),
        message: String(body.message ?? ""),
        changes: body.changes.map((change) => ({
          path: String(change.path ?? ""),
          content: String(change.content ?? ""),
          delete: Boolean(change.delete),
        })),
        createBranchFrom: body.createBranchFrom ? String(body.createBranchFrom) : undefined,
      })
    );
  } catch (error) {
    return githubErrorResponse(error);
  }
}
