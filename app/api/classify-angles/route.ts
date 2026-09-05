import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyUploadedAngles } from "@/lib/classifyUploadedAngles";

/**
 * AI-classifies a set of already-uploaded photos into lib/tripo.ts's
 * multiview [front,left,back,right] slots (see lib/classifyAngles.ts's own
 * header for why this replaced upload-order/position-based assignment).
 * Cookie-authed web app twin of app/api/extension/classify-angles/route.ts.
 *
 * CLAUDE.md rule 30: proxy.ts already redirects logged-out browsers away
 * from /dashboard, but that's a UX convenience, not a boundary — this route
 * independently verifies the caller below regardless of what proxy did.
 */
export async function POST(request: Request) {
  // CLAUDE.md rule 31: getUser() round-trips to the Auth server and
  // confirms the token is still valid; getSession() would trust a cookie
  // that could be stale or forged.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Буруу JSON бие" }, { status: 400 });
  }

  const { keys } = (body ?? {}) as { keys?: unknown };
  const result = await classifyUploadedAngles(user.id, keys);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ slots: result.slots });
}
