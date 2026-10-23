import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Verifies the developer lock password. The expected value lives only in the
 * environment (DEV_UNLOCK_PASS) — it is never sent to the browser, so it can't
 * be found via "Inspect" or the JS bundle. Only a boolean verdict comes back.
 */
export const dynamic = "force-dynamic";

const EXPECTED = () =>
  (process.env.DEV_UNLOCK_PASS ?? "developer@123").replace(/\s+/g, "");

export async function POST(request: Request) {
  let attempt = "";
  try {
    const body = (await request.json()) as { password?: unknown } | null;
    if (typeof body?.password === "string") attempt = body.password.trim();
  } catch {
    attempt = "";
  }

  const expected = EXPECTED();
  const a = Buffer.from(attempt);
  const b = Buffer.from(expected);
  const ok = a.length === b.length ? timingSafeEqual(a, b) : false;

  if (!ok) {
    // Small delay blunts timing probes and brute force feels sluggish.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json(
      { ok: false, error: "Wrong password." },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true });
}
