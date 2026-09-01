import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken } from "@/lib/apiToken";

/**
 * Issues/revokes the personal access token the Chrome extension
 * authenticates with (see lib/apiToken.ts). Cookie-authed like the rest of
 * the dashboard (CLAUDE.md rule 30/31) — every write here goes through
 * service_role, matching migration 0018's grants: `authenticated` can only
 * ever SELECT its own api_tokens row, never write one directly.
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
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ token: data ?? null });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  }

  const admin = createAdminClient();

  // MVP = one active token per user — issuing a new one revokes any prior
  // active token, the simplest possible revoke story (no token list UI).
  // rotate_api_token (migration 0021) does the revoke-then-insert as one
  // atomic DB transaction: a failed insert rolls back the revoke instead of
  // leaving the user with no active token, and a partial unique index
  // guarantees two concurrent calls can't both leave a token active.
  const { token, hash, last4 } = generateToken();
  const { error } = await admin.rpc("rotate_api_token", {
    uid: user.id,
    new_hash: hash,
    new_last4: last4,
    new_label: "Chrome Extension",
  });

  if (error) {
    return NextResponse.json({ error: "Токен үүсгэхэд алдаа гарлаа" }, { status: 500 });
  }

  // The only time the plaintext token is ever returned — never retrievable
  // again after this response.
  return NextResponse.json({ token });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  }

  const admin = createAdminClient();
  await admin.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", user.id).is("revoked_at", null);

  return NextResponse.json({ ok: true });
}
