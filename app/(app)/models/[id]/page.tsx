import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModelDetail } from "@/components/ModelDetail";

/**
 * Ownership check here is the RLS "models: owner select" policy on this
 * query (rule 30 — don't rely on the (app) layout's auth check alone, that
 * only proves *a* user is logged in, not that they own *this* model). Using
 * the request-scoped client (not the admin client) means a non-owner's
 * query simply returns no row, which reads identically to "doesn't exist" —
 * not leaking whether the id belongs to someone else.
 *
 * No wrapping title/padding here (unlike the old placeholder) — design/02 is
 * edge-to-edge, and ModelDetail owns its own full-height layout down to a
 * bottom-docked AR button, which needs this page to hand it the full flex
 * column rather than nesting it inside extra chrome.
 */
export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: model } = await supabase.from("models").select("*").eq("id", id).maybeSingle();

  if (!model) notFound();

  return <ModelDetail initialModel={model} />;
}
