"use client";

import { useEffect } from "react";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface GeneratingStepProps {
  modelId: string;
  previewUrl: string;
  createdAt: string;
  /** e.g. classify-angles fell back to a single photo — shown under the elapsed time. */
  note?: string | null;
  /** Model finished successfully — CaptureFlow.tsx shows ResultStep next, doesn't navigate away. */
  onReady: (model: ModelRow) => void;
  /** Model failed — CaptureFlow.tsx sends the user to /models/[id], which already renders the failure state well. */
  onFailed: () => void;
}

// Shown in place, inside the /create flow itself, right after Create is
// pressed — not a redirect to My Models (which never shows a pending row
// at all, see library/page.tsx's status filter) and not a separate
// /models/[id]/waiting route either. No initialModel passed to
// useModelRealtime: the row was just inserted as "pending" moments ago by
// /api/generate, so there's nothing to seed beyond that assumption — model
// stays undefined until the first real UPDATE event, which is exactly the
// "still generating" state this screen wants anyway.
//
// Sized at aspect-[4/5] and full width (2026-08-24 — the first version
// here was a small max-w-xs box that read as an afterthought) so it's the
// dominant thing on screen, same footprint as ModelDetail.tsx's own viewer
// and the same gradient backdrop, rather than a token-sized placeholder.
//
// Renders below CaptureFlow.tsx's own CaptureChoice cards, not as a
// separate full-screen step — no padding of its own, CaptureFlow's shared
// wrapper owns that once for every phase.
export function GeneratingStep({ modelId, previewUrl, createdAt, note, onReady, onFailed }: GeneratingStepProps) {
  const model = useModelRealtime(modelId);
  const elapsed = useElapsedTime(createdAt);

  useEffect(() => {
    if (!model) return;
    if (model.status === "ready") onReady(model);
    else if (model.status === "failed") onFailed();
  }, [model, onReady, onFailed]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-card"
        style={{
          background: "radial-gradient(circle at 50% 38%, var(--color-surface-hover), var(--color-bg) 75%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="" className="size-full object-contain opacity-40" />
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="size-16 animate-pulse rounded-md" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-surface-hover">
          <div className="h-full w-1/3 animate-pulse bg-text" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-body text-text">Таны model үүсгэгдэж байна</p>
        <p className="text-small uppercase tracking-wide text-text-muted">{elapsed}</p>
        {note && <p className="text-small text-text-muted">{note}</p>}
      </div>
    </div>
  );
}
