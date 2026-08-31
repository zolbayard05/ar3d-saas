import { NextResponse } from "next/server";
import { resolveApiToken } from "@/lib/apiToken";
import { presignUpload } from "@/lib/presignUpload";

/**
 * Token-authed twin of app/api/upload-url/route.ts, for the Chrome
 * extension (no cookie/Supabase session available there). Independently
 * verifies its own caller via a Bearer personal access token (CLAUDE.md
 * rule 30) — this is the extension's entire trust boundary.
 */
export async function POST(request: Request) {
  const userId = await resolveApiToken(request);
  if (!userId) {
    return NextResponse.json({ error: "Токен буруу эсвэл цуцлагдсан байна" }, { status: 401 });
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

  const result = await presignUpload(userId, { contentType, contentLength });

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
