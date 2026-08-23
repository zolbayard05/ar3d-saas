import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LibraryFeed } from "@/components/LibraryFeed";

// RLS "models: owner select" (rule 30) already scopes the models query to
// the caller's own rows — same pattern as app/(app)/dashboard/page.tsx.
// getUser() is called directly (not just relying on the (app) layout's own
// check) because this page also needs the caller's own id for the
// `profiles` query, not just for auth.
export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: models }, { data: profile }] = await Promise.all([
    supabase.from("models").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("credits").eq("id", user.id).single(),
  ]);

  return <LibraryFeed userId={user.id} initialModels={models ?? []} initialCredits={profile?.credits ?? 0} />;
}
