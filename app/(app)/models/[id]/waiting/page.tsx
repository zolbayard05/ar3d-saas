import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WaitingScreen } from "@/components/WaitingScreen";

// No explicit owner filter needed here the way dashboard/library now need
// one: a pending/processing row only ever matches RLS's owner-select policy
// (migration 0011's public policy is status = 'ready' only), so a
// non-owner's request for an in-progress model still reads as "doesn't
// exist." A non-owner hitting this URL for an already-ready model does now
// match 0011's policy — but that just falls into the redirect below, onto
// the same public detail page a shared link already sends them to.
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
