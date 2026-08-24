import { createClient } from "@/lib/supabase/server";
import { HomeFeed } from "@/components/HomeFeed";

// Public showcase feed: everyone sees is_showcase models (curated
// admin-only, migration 0013 — never client-settable, so "ready" is
// enforced here defensively, not because it can currently be false); a
// signed-in visitor also sees their own models, any status, exactly like
// before this feature existed.
//
// One query, one OR, not two queries concatenated — a row matching both
// branches (an admin's own showcase model) comes back exactly once because
// that's how SQL OR works, not because of any dedup step here. Two separate
// queries glued together would need one; this doesn't.
//
// Still explicit, still not trusting migration 0011's broader public-ready
// policy to imply the right scope on its own — same rule 30 principle this
// file already had to learn once (0011 leaked into this exact query before
// the .eq("user_id", ...) fix). 0011 stays as-is: it's what makes a shared
// /models/[id] link work for *any* ready model, deliberately broader than
// "showcase." This query is what actually decides what's IN the feed, and
// it was never going to be safe to let RLS's outer bound answer that
// question by itself.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const query = supabase.from("models").select("*").order("created_at", { ascending: false });
  const { data: models } = user
    ? await query.or(`and(status.eq.ready,is_showcase.eq.true),user_id.eq.${user.id}`)
    : await query.eq("status", "ready").eq("is_showcase", true);

  return <HomeFeed initialModels={models ?? []} />;
}
