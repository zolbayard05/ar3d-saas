import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LibraryFeed } from "@/components/LibraryFeed";

// Explicit .eq("user_id", user.id) on the models query — NOT just RLS —
// same reasoning as app/(app)/dashboard/page.tsx: migration 0011's public
// select-ready policy means a bare `.select("*")` would now also return
// every other user's ready models. getUser() is called directly (not just
// relying on the (app) layout's own check) because this page also needs
// the caller's own id for the `profiles` query, not just for auth.
export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Excludes pending/processing rows (rule from 2026-08-24: generation
  // status is confined to CaptureFlow.tsx's own in-place GeneratingStep,
  // never shown here). A retry's own optimistic pending row still appears
  // via LibraryFeed's local state after this initial fetch — that's a
  // deliberate exception scoped to retrying an existing card in place,
  // not this query.
  const [{ data: models }, { data: profile }] = await Promise.all([
    supabase
      .from("models")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["ready", "failed"])
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("credits").eq("id", user.id).single(),
  ]);

  return <LibraryFeed userId={user.id} initialModels={models ?? []} initialCredits={profile?.credits ?? 0} />;
}
