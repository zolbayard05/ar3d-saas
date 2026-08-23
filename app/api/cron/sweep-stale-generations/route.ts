import { NextResponse } from "next/server";
import { sweepStaleGenerations } from "@/lib/sweepStaleGenerations";

/**
 * Backstop for lib/sweepStaleGenerations.ts's opportunistic per-webhook
 * call: this catches the case where there's been NO webhook traffic at all
 * to piggyback on (an otherwise-silent stuck row would wait forever for
 * unrelated traffic to trigger recovery). Scheduled via vercel.json's
 * `crons` entry, once daily — see that file and lib/sweepStaleGenerations.ts
 * for why daily, not more often (Hobby-tier Vercel Cron Jobs fail to deploy
 * at any higher frequency; the opportunistic path already covers fast
 * recovery during real traffic, so this only needs to guarantee eventual
 * recovery, not fast recovery).
 *
 * Secured per Vercel's own documented pattern (CRON_SECRET env var, sent
 * back as this request's own Authorization header automatically by Vercel's
 * scheduler) — without this, the route would be a public, unauthenticated
 * trigger for refunding/failing rows.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sweepStaleGenerations();
  return NextResponse.json({ ok: true, ...result });
}
