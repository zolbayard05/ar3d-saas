"use client";

import Link from "next/link";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface ActiveGenerationBannerProps {
  initialModel: ModelRow;
}

// Compact version of ModelCard.tsx's own pending state (dimmed thumbnail,
// pulsing app-mark, same "Generating · M:SS" label) — same visual language,
// shrunk to a horizontal strip since this sits below CaptureChoice's two
// tap targets rather than in a grid. Links straight to /models/[id], which
// already renders its own generating state (ModelDetail.tsx's !ready
// branch) — no need to duplicate GeneratingStep.tsx's screen here too.
export function ActiveGenerationBanner({ initialModel }: ActiveGenerationBannerProps) {
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;
  const elapsed = useElapsedTime(model.created_at);

  if (model.status !== "pending" && model.status !== "processing") return null;

  return (
    <Link
      href={`/models/${model.id}`}
      className="flex items-center gap-3 rounded-card bg-surface p-2 hover:bg-surface-hover"
    >
      <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface-hover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/uploads/${model.source_image_key}`}
          alt=""
          className="size-full object-cover opacity-50"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="size-6 animate-pulse rounded-md" />
        </div>
      </div>
      <p className="text-small uppercase tracking-wide text-text-muted">Generating · {elapsed}</p>
    </Link>
  );
}
