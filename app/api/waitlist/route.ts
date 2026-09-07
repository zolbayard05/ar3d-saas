import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Backs every "Chrome-д нэмэх" button on the landing page while the Chrome
// Web Store listing isn't published yet (see components/DesktopWaitlistCta.tsx).
// Public, unauthenticated — migration 0025's RLS policy is what actually
// scopes this (insert-only, no select/update/delete for anon), not this
// route's own logic. No CAPTCHA/rate-limit: an accepted gap for a low-stakes
// table nobody reads back through the client.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const source = typeof body?.source === "string" ? body.source.slice(0, 40) : "landing";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Имэйл хаяг буруу байна" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist_signups").insert({ email, source });

  // Unique-index conflict (already signed up, possibly from a different
  // CTA on the page) is a success from the caller's point of view, not an
  // error — they're on the list either way.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Алдаа гарлаа, дахин оролдоно уу" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
