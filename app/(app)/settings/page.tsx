import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApiTokenSettings } from "@/components/ApiTokenSettings";

// Same pattern as app/(app)/credits/page.tsx — getUser() here directly,
// not just proxy.ts's PROTECTED_PREFIXES entry (rule 30). Not added to
// lib/navItems.ts (that's the mobile bottom nav / desktop sidebar rail,
// rule 39) — this is a desktop-oriented, occasional-use page.
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ?next=/settings so a signed-out desktop visitor lands back here after
  // signing in, instead of useAuth's default post-login /dashboard (which
  // the desktop device gate immediately bounces to "/" — see proxy.ts).
  if (!user) redirect("/login?next=/settings");

  return <ApiTokenSettings />;
}
