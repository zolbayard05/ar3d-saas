import { NextResponse } from "next/server";
import { resolveApiToken } from "@/lib/apiToken";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildModelUrl } from "@/lib/models";

const LIST_LIMIT = 30;

/**
 * Lists the caller's own past generations for the extension popup's "Миний
 * загварууд" view — the popup otherwise only ever knows about whichever
 * single generation it just submitted (extension/popup.js's
 * realifyActiveGeneration/realifyLastResult), with no way to browse anything
 * generated in an earlier popup session. Read-only; row ownership is scoped
 * to the token's own userId the same way app/api/extension/models/[id]/
 * route.ts scopes single-model lookups (rule 30 — resolveApiToken is the
 * entire trust boundary for every /api/extension/* route).
 */
export async function GET(request: Request) {
  const userId = await resolveApiToken(request);
  if (!userId) {
    return NextResponse.json({ error: "Токен буруу эсвэл цуцлагдсан байна" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("models")
    .select("id, status, render_url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: "Загваруудыг ачаалахад алдаа гарлаа" }, { status: 500 });
  }

  return NextResponse.json({
    models: (data ?? []).map((m) => ({
      id: m.id,
      status: m.status,
      createdAt: m.created_at,
      renderUrl: m.render_url ? buildModelUrl(m.render_url) : null,
    })),
  });
}
