import { NextResponse } from "next/server";
import { resolveApiToken } from "@/lib/apiToken";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tells the extension popup which account its saved token belongs to — the
 * popup itself only ever holds an opaque bearer token (extension/popup.js's
 * getToken/setToken), with no way to show the user which Realify account
 * that actually is. Read-only, no side effects; called once on boot and
 * whenever the token changes.
 */
export async function GET(request: Request) {
  const userId = await resolveApiToken(request);
  if (!userId) {
    return NextResponse.json({ error: "Токен буруу эсвэл цуцлагдсан байна" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ email: data.user.email ?? null });
}
