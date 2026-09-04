import { NextResponse } from "next/server";
import { resolveApiToken } from "@/lib/apiToken";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tells the extension popup which account its saved token belongs to, and
 * its current credit balance — the popup itself only ever holds an opaque
 * bearer token (extension/popup.js's getToken/setToken), with no way to show
 * either otherwise. Read-only, no side effects; called once on boot and
 * whenever the token changes, so a credit purchase completed in a separate
 * tab (extension/popup.js's "Цэнэглэх" flow) is reflected the next time the
 * popup opens without any extra wiring.
 */
export async function GET(request: Request) {
  const userId = await resolveApiToken(request);
  if (!userId) {
    return NextResponse.json({ error: "Токен буруу эсвэл цуцлагдсан байна" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: userData, error: userError }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("credits").eq("id", userId).maybeSingle(),
  ]);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ email: userData.user.email ?? null, credits: profile?.credits ?? 0 });
}
