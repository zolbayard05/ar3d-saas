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
 */
export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: model } = await supabase.from("models").select("*").eq("id", id).maybeSingle();

  if (!model) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-heading text-text">{model.title || "Untitled model"}</h1>
      <ModelDetail initialModel={model} />
    </div>
  );
}
