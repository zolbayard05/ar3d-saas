import { createClient } from "@/lib/supabase/server";
import { DashboardModels } from "@/components/DashboardModels";

// RLS "models: owner select" (rule 30) scopes this to the caller's own rows
// without needing an explicit .eq("user_id", ...) — same pattern as
// app/(app)/models/[id]/page.tsx.
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: models } = await supabase
    .from("models")
    .select("*")
    .order("created_at", { ascending: false });

  return <DashboardModels initialModels={models ?? []} />;
}
