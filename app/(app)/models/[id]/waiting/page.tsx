import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WaitingScreen } from "@/components/WaitingScreen";

// Same ownership pattern as app/(app)/models/[id]/page.tsx — RLS scopes the
// query to the caller's own row (rule 30), a non-owner's request reads
// identically to "doesn't exist."
export default async function WaitingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: model } = await supabase.from("models").select("*").eq("id", id).maybeSingle();

  if (!model) notFound();

  // Someone navigating straight to this URL for an already-finished model
  // (a stale tab, a bookmark) belongs on the real detail screen, not a
  // "waiting" view for a wait that's already over.
  if (model.status !== "pending" && model.status !== "processing") {
    redirect(`/models/${id}`);
  }

  return <WaitingScreen initialModel={model} />;
}
