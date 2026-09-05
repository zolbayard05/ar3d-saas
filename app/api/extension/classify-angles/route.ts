import { NextResponse } from "next/server";
import { resolveApiToken } from "@/lib/apiToken";
import { classifyUploadedAngles } from "@/lib/classifyUploadedAngles";

/**
 * Token-authed twin of app/api/classify-angles/route.ts, for the Chrome
 * extension (no cookie/Supabase session available there). Independently
 * verifies its own caller via a Bearer personal access token (CLAUDE.md
 * rule 30) — this is the extension's entire trust boundary.
 *
 * This is what makes extension/background.js's own gallery-scan heuristic
 * actually trustworthy: that scan has zero real signal about which
 * detected thumbnail shows which angle (it only knows "found near the
 * clicked image in a gallery container"), so asking the USER to manually
 * assign "this thumbnail is the left side" was never something either the
 * extension or a visitor right-clicking a stranger's product photo could
 * reliably do. Handing the whole candidate set (however many — up to
 * lib/classifyAngles.ts's MAX_CLASSIFY_IMAGES) to this endpoint instead
 * lets Gemini pick the best front/left/back/right subset directly,
 * excluding duplicates/close-ups rather than force-fitting them.
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

  const { keys } = (body ?? {}) as { keys?: unknown };
  const result = await classifyUploadedAngles(userId, keys);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ slots: result.slots });
}
