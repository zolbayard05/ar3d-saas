import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken } from "@/lib/apiToken";

// Sanity cap, not a real product limit — stops the list from growing
// unbounded if someone scripts against this route, without needing a
// paid-tier distinction the app doesn't have yet.
const MAX_ACTIVE_TOKENS = 10;

/**
 * Issues/lists/revokes the personal access tokens the Chrome extension
 * authenticates with (see lib/apiToken.ts). Cookie-authed like the rest of
 * the dashboard (CLAUDE.md rule 30/31) — every write here goes through
 * service_role via migration 0022's issue_api_token/revoke_api_token,
 * matching migration 0018's grants: `authenticated` can only ever SELECT
 * its own api_tokens rows, never write one directly.
 *
 * Multiple tokens can be active at once (one per device) — migration 0021's
 * "one active token per user" invariant got dropped in 0022 after it
 * silently killed a working extension on one machine the moment a second
 * machine issued its own token.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  }

  const { data } = await supabase
    .from("api_tokens")
    .select("id, label, token_last4, created_at, last_used_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({ tokens: data ?? [] });
}

export async function POST(request: Request) {
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
    body = {};
  }
  const { label } = (body ?? {}) as { label?: unknown };
  const trimmedLabel = typeof label === "string" ? label.trim().slice(0, 60) : "";

  const admin = createAdminClient();

  const { count } = await admin
    .from("api_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    return NextResponse.json(
      { error: `Идэвхтэй токены хязгаар (${MAX_ACTIVE_TOKENS}) хэтэрсэн байна. Эхлээд ашиглагдахгүй байгаа токеноо цуцлаарай.` },
      { status: 400 },
    );
  }

  const { token, hash, last4 } = generateToken();
  const { data: newId, error } = await admin.rpc("issue_api_token", {
    uid: user.id,
    new_hash: hash,
    new_last4: last4,
    new_label: trimmedLabel || "Chrome Extension",
  });

  if (error || !newId) {
    return NextResponse.json({ error: "Токен үүсгэхэд алдаа гарлаа" }, { status: 500 });
  }

  // The only time the plaintext token is ever returned — never retrievable
  // again after this response.
  return NextResponse.json({ token, id: newId });
}

export async function DELETE(request: Request) {
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
  const { tokenId } = (body ?? {}) as { tokenId?: unknown };
  if (typeof tokenId !== "string" || !tokenId) {
    return NextResponse.json({ error: "tokenId дутуу байна" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: revoked, error } = await admin.rpc("revoke_api_token", { uid: user.id, token_id: tokenId });

  if (error) {
    return NextResponse.json({ error: "Токен цуцлахад алдаа гарлаа" }, { status: 500 });
  }
  if (!revoked) {
    // Either not this user's token, or already revoked — same response
    // either way (rule 30: don't leak whether a foreign id exists).
    return NextResponse.json({ error: "Токен олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
