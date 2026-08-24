import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaptureFlow } from "@/components/CaptureFlow";

// CaptureFlow needs the caller's own id for CaptureChoice's credits line
// (useCredits), not just auth — same reason app/(app)/library/page.tsx
// calls getUser() directly rather than relying on the (app) layout's own
// check alone (rule 30).
export default async function CreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Now that BottomNav stays visible on /create (2026-08-24), a user can
  // navigate away mid-generation and come back — without this, returning
  // to /create would show the picker with no sign the earlier generation
  // is still running. CaptureFlow.tsx renders this exactly like a
  // generation just started in this same session (the full GeneratingStep,
  // not a separate smaller "still going" banner — that was tried and
  // retired for showing two different generating UIs instead of one).
  // Only the single most recent one: showing several would need its own
  // list UI this screen was never meant to have.
  const { data: activeModel } = await supabase
    .from("models")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return <CaptureFlow userId={user.id} initialActiveModel={activeModel ?? undefined} />;
}
