"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

type Stage = "analysing" | "building" | "texturing";

// Soft, time-based heuristic for the ONE stage split we have no real signal
// for — Tripo's webhook only tells us start/complete, never a mid-generation
// substage. 15s is a guess at "still uploading/queued" vs. "actually
// generating," not measured against real per-stage timing (no such data
// exists to measure against). The analysing -> building and building ->
// texturing transitions below it ARE real: glb_url appearing is the actual
// backend event marking GLB generation done and USDZ/texture conversion
// starting (see app/api/webhooks/tripo/route.ts) — "applying texture" isn't
// a guess, it's naming what that real phase of Tripo's pipeline is.
const ANALYSING_THRESHOLD_SECONDS = 15;

function stageFor(model: ModelRow, elapsedSeconds: number): Stage {
  if (model.glb_url) return "texturing";
  if (elapsedSeconds < ANALYSING_THRESHOLD_SECONDS) return "analysing";
  return "building";
}

const STAGE_LABELS: Record<Stage, string> = {
  analysing: "Analysing",
  building: "Building form",
  texturing: "Applying texture",
};

// Lands here straight from /create (rule 12: async pipeline never blocks on
// generation) instead of dumping the user back on the feed with nothing but
// a status word. Under app/(app)/models/[id]/, so BottomNav's existing
// /models/ path check already hides the floating nav here too — a focused
// waiting screen doesn't need it competing for attention any more than the
// detail screen's AR button does.
export function WaitingScreen({ initialModel }: { initialModel: ModelRow }) {
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;
  const router = useRouter();
  const elapsedSeconds = useElapsedSeconds(model.created_at);
  const elapsed = useElapsedTime(model.created_at);
  const stage = stageFor(model, elapsedSeconds);

  // Transient by design: once the row leaves pending/processing (ready or
  // failed), the real detail screen already knows how to render both of
  // those states correctly — this screen only ever needs to show the
  // in-between.
  useEffect(() => {
    if (model.status !== "pending" && model.status !== "processing") {
      router.replace(`/models/${model.id}`);
    }
  }, [model.status, model.id, router]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2">
        {(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
          <p key={s} className={cn("text-small uppercase tracking-wide", s === stage ? "text-text" : "text-text-muted")}>
            {STAGE_LABELS[s]}
          </p>
        ))}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/uploads/${model.source_image_key}`} alt="" className="max-h-64 w-auto max-w-full opacity-40" />

      <div className="flex w-full max-w-xs flex-col items-center gap-2">
        <div className="h-0.5 w-full overflow-hidden bg-surface-hover">
          <div className="h-full w-1/3 animate-pulse bg-text" />
        </div>
        <p className="text-small uppercase tracking-wide text-text-muted">{elapsed}</p>
      </div>

      <Link
        href="/dashboard"
        className="text-small uppercase tracking-wide text-text-muted underline underline-offset-2 hover:text-text"
      >
        Continue browsing
      </Link>
    </div>
  );
}
