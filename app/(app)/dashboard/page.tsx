import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeFeed } from "@/components/HomeFeed";

// Explicit .eq("user_id", user.id) — NOT just RLS — because migration 0011
// added a second permissive SELECT policy (public, status = 'ready', no
// owner restriction) so a bare `.select("*")` now returns the union of "my
// rows" and "everyone's ready rows." That's correct for /models/[id] (the
// whole point), wrong here: this feed must stay scoped to the caller's own
// models only. Same rule 30 principle as everywhere else in this codebase —
// don't trust a policy elsewhere to imply the right scope for this query.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: models } = await supabase
    .from("models")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <HomeFeed initialModels={models ?? []} />;
}
