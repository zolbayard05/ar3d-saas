"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusStrip } from "@/components/StatusStrip";
import { MasonryGrid } from "@/components/MasonryGrid";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

// design/01-home-feed.png, design/06-feed-with-job.png (rule 40 — these are
// now themselves the reference, not the retired mockups). Real data end to
// end: dimensions, live status, retry, source-photo thumbnails.
export function HomeFeed({ initialModels }: { initialModels: ModelRow[] }) {
  const [models, setModels] = useState(initialModels);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function handleRetry(model: ModelRow) {
    setRetryError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageKey: model.source_image_key, idempotencyKey: crypto.randomUUID() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed to retry (${res.status})`);

      // A retry is a genuinely new /api/generate call (own idempotency key,
      // own credit deduction) - not resuming the failed row, which stays
      // exactly as it was. The design shows "try again" in place on one
      // card; our data model ties one idempotency key to one row, so a new
      // attempt is a new row, appended to the top of the feed instead.
      setModels((prev) => [
        {
          ...model,
          id: body.modelId,
          status: "pending",
          glb_url: null,
          usdz_url: null,
          render_url: null,
          provider_job_id: null,
          usdz_provider_job_id: null,
          idempotency_key: null,
          size_retry_count: 0,
          bbox_width_m: null,
          bbox_depth_m: null,
          bbox_height_m: null,
          error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Failed to retry");
    }
  }

  const activeJob = models.find((m) => m.status === "pending" || m.status === "processing");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* CLAUDE.md rule 38 — bare wordmark, no bar/fill/border/shadow,
          nothing on its right. Scrolls with the content below (it's inside
          the same scroll container, not a separate sticky element). */}
      <p className="shrink-0 px-2 pt-4 pb-3 text-body font-semibold text-text">AR3D</p>

      {activeJob && <StatusStrip createdAt={activeJob.created_at} />}

      {retryError && <p className="px-2 py-2 text-small text-danger">{retryError}</p>}

      {models.length === 0 ? (
        <EmptyState
          className="m-4"
          title="No models yet"
          description="Tap create to generate your first 3D model."
        />
      ) : (
        // CLAUDE.md rule 39: the floating nav sits over this scroll area, so
        // its last row needs bottom padding clearing the button group (24px
        // gap + 56px button height + the device safe area) plus breathing
        // room, or it's permanently hidden underneath.
        <div
          className="overflow-y-auto"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
        >
          <MasonryGrid models={models} onRetry={handleRetry} />
        </div>
      )}
    </div>
  );
}
