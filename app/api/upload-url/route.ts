import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presignUpload } from "@/lib/presignUpload";

/**
 * Issues a presigned PUT URL for a source photo, for the cookie-authed web
 * app. Auth resolution only — see lib/presignUpload.ts, shared with
 * app/api/extension/upload-url/route.ts.
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

  const { contentType, contentLength } = (body ?? {}) as {
    contentType?: unknown;
    contentLength?: unknown;
  };

  const result = await presignUpload(user.id, { contentType, contentLength });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    uploadUrl: result.uploadUrl,
    key: result.key,
    contentType: result.contentType,
    expiresAt: result.expiresAt,
  });
}
