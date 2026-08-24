import { createClient } from "@/lib/supabase/server";
import { HomeFeed } from "@/components/HomeFeed";

// Pure public showcase feed — is_showcase models only (curated admin-only,
// migration 0013 — never client-settable, so "ready" is enforced here
// defensively, not because it can currently be false), the same list for
// every visitor regardless of session. A signed-in user's own models used
// to also appear here (deduped via a single OR query against their own
// user_id); moved out per explicit feedback — a personal in-progress/failed
// generation mixed into what's meant to read as a curated showcase was
// confusing, and it already has its own home: /library, unconditionally,
// not "the feed, plus showcase." No getUser() call needed here anymore —
// this query has nothing left that depends on who's asking.
export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: models } = await supabase
    .from("models")
    .select("*")
    .eq("status", "ready")
    .eq("is_showcase", true)
    .order("created_at", { ascending: false });

  return <HomeFeed initialModels={models ?? []} />;
}
