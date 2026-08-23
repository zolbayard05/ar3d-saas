import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModelDetail } from "@/components/ModelDetail";

/**
 * Moved out of app/(app) so a signed-out visitor following a shared link
 * isn't bounced to /login by that group's layout (which redirects
 * unconditionally). getUser() here is optional, not a gate — session
 * presence only decides which affordances ModelDetail shows (rule 30: an
 * absent check here is fine precisely because nothing downstream trusts
 * `isOwner`/`hasSession` for security, only for UI; the actual read
 * boundary is the RLS policy below, and the actual write boundary is each
 * hook's own owner-gated persist call plus the DB column grants).
 *
 * The query itself is unchanged from the old owner-only page: RLS now OR's
 * two permissive SELECT policies (0001's owner-only, 0011's public
 * status='ready') so this naturally returns the row for an owner, for a
 * signed-in non-owner, or for anonymous — all three exactly when they
 * should get one, never leaking whether a non-visible id belongs to anyone.
 */
export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: model }, { data: { user } }] = await Promise.all([
    supabase.from("models").select("*").eq("id", id).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!model) notFound();

  const hasSession = !!user;
  const isOwner = user?.id === model.user_id;

  return <ModelDetail initialModel={model} hasSession={hasSession} isOwner={isOwner} />;
}
