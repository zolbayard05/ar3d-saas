import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 30 minutes. Set from real data, not guessed: the slowest fully-observed
// generation (Tripo's own task timestamps, upload to USDZ-conversion-done)
// was 368.6s. This is ~4.9x that — wide margin on purpose, from only two
// complete samples with 9x variance already observed in the USDZ step alone
// (19.5s vs 172s). A false positive here refunds and fails a model that was
// going to succeed, which the person who asked for this said plainly is
// worse than a stuck row sitting a bit longer — so this errs long. Revisit
// once there's a real distribution of generation times to set this from
// instead of two data points (same status as MAX_ASPECT_RATIO/
// DEFAULT_FACE_LIMIT elsewhere in this codebase).
export const STALE_GENERATION_TIMEOUT_SECONDS = 30 * 60;

/**
 * Recovers a model whose webhook chain died partway — no Tripo retry ever
 * arriving, no ready, no refund, credit and row both stuck forever. Called
 * from two places (lib/sweepStaleGenerations.ts's only two callers):
 *
 * 1. Opportunistically, once per Tripo webhook delivery (app/api/webhooks/
 *    tripo/route.ts) — runs on real traffic with zero extra infrastructure,
 *    works identically on every Vercel plan tier.
 * 2. A once-daily Vercel Cron (app/api/cron/sweep-stale-generations/route.ts,
 *    vercel.json) — backstop for total silence (no webhook traffic at all
 *    to piggyback on). Once/day is deliberate, not a compromise: Hobby-tier
 *    Vercel Cron Jobs fail to deploy at anything more frequent than daily,
 *    and (1) already covers the common case fast, so this only needs to
 *    guarantee eventual recovery, not fast recovery.
 *
 * Race safety against a live webhook processing the SAME row: refund_credit
 * (migration 0002) is already a single atomic `UPDATE ... WHERE status <>
 * 'failed' RETURNING` — its own design doc explains why that one statement
 * is the idempotency guard, not a separate check-then-act. That guarantee
 * extends to this caller for free: whichever of {this sweep, a webhook
 * calling refund_credit on its own failure path} commits first wins: Postgres's
 * row lock serializes the two UPDATEs, and the second one's `status <>
 * 'failed'` WHERE clause simply matches zero rows once the first has run. No
 * separate lock (Redis or otherwise) is needed — the atomicity already lives
 * in the one UPDATE statement, not in coordination between callers.
 *
 * The other half of that race — a webhook landing AFTER the sweep already
 * refunded — is guarded on the webhook's side (app/api/webhooks/tripo/
 * route.ts's `.neq("status", "failed")` on both its glb_url and
 * usdz_url/ready writes): without that, a late-arriving success could
 * silently revive a row this function already told the user (and refunded)
 * had failed.
 */
export async function sweepStaleGenerations(): Promise<{ swept: number; ids: string[] }> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STALE_GENERATION_TIMEOUT_SECONDS * 1000).toISOString();

  const { data: stale, error } = await admin
    .from("models")
    .select("id, created_at")
    .in("status", ["pending", "processing"])
    .lt("created_at", cutoff);

  if (error) {
    console.warn("sweepStaleGenerations: query failed", error);
    return { swept: 0, ids: [] };
  }
  if (!stale || stale.length === 0) {
    return { swept: 0, ids: [] };
  }

  const swept: string[] = [];
  for (const row of stale) {
    const ageSeconds = Math.round((Date.now() - new Date(row.created_at).getTime()) / 1000);
    // Rule (see ModelDetail.tsx): `error` is shown to the user verbatim on
    // a failed model's detail page, not just logged — plain language first,
    // the raw number folded in after for anyone debugging.
    const { data: didRefund } = await admin.rpc("refund_credit", {
      model_id: row.id,
      failure_reason: `This took too long and timed out (${Math.round(ageSeconds / 60)} min, no response from the provider). Your credit has been refunded — feel free to try again.`,
    });
    if (didRefund) {
      console.warn(`sweepStaleGenerations: refunded and failed stale model ${row.id} (age ${ageSeconds}s)`);
      swept.push(row.id);
    }
    // didRefund === false means a webhook (or the other sweep trigger) beat
    // this call to the same row in the moment between the SELECT above and
    // this RPC call — refund_credit's own atomicity already handled that
    // correctly; nothing further to do for this row.
  }

  return { swept: swept.length, ids: swept };
}
