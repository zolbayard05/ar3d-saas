"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";

export interface GeneratingStepProps {
  modelId: string;
  previewUrl: string;
  createdAt: string;
}

// Shown in place, inside the /create flow itself, right after Create is
// pressed — not a redirect to My Models (which never shows a pending row
// at all, see library/page.tsx's status filter) and not a separate
// /models/[id]/waiting route either. No initialModel passed to
// useModelRealtime: the row was just inserted as "pending" moments ago by
// /api/generate, so there's nothing to seed beyond that assumption — model
// stays undefined until the first real UPDATE event, which is exactly the
// "still generating" state this screen wants anyway. Same dimmed-photo +
// pulsing-mark + progress-line treatment as ModelCard.tsx's own pending
// state, reused rather than re-invented, so "generating" looks identical
// wherever it's seen.
export function GeneratingStep({ modelId, previewUrl, createdAt }: GeneratingStepProps) {
  const model = useModelRealtime(modelId);
  const router = useRouter();
  const elapsed = useElapsedTime(createdAt);

  useEffect(() => {
    if (model && model.status !== "pending" && model.status !== "processing") {
      router.replace(`/models/${modelId}`);
    }
  }, [model, modelId, router]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
      <div className="relative w-full max-w-xs overflow-hidden rounded-card bg-surface-hover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="" className="block w-full opacity-50" />
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="size-12 animate-pulse rounded-md" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-surface-hover">
          <div className="h-full w-1/3 animate-pulse bg-text" />
        </div>
      </div>
      <p className="text-small uppercase tracking-wide text-text-muted">Generating · {elapsed}</p>
    </div>
  );
}
