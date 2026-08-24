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

  // The DELETE request (app/api/models/delete/route.ts) and its confirm
  // prompt already happened inside lib/deleteModel.ts by the time this
  // fires — this only reconciles local state once the server call succeeded.
  function handleDelete(model: ModelRow) {
    setModels((prev) => prev.filter((m) => m.id !== model.id));
  }

  const activeJob = models.find((m) => m.status === "pending" || m.status === "processing");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Wordmark, no bar/fill/border/shadow, nothing on its right. Scrolls
          with the content below (it's inside the same scroll container, not
          a separate sticky element). Icon before the name — the actual
          PWA app icon (icon-192.png, framed R), sized up to size-9 (36px)
          so the frame stays legible (checked down to 32px). */}
      <div className="flex shrink-0 items-center gap-2 px-2 pt-4 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="size-9 rounded-md" />
        <p className="text-heading font-semibold text-text">Realify</p>
      </div>

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
        // room, or it's permanently hidden underneath. flex-1/min-h-0 are
        // load-bearing, not decorative: without them this div isn't height-
        // constrained by its flex-column parent (a flex item's default
        // min-height is `auto`, i.e. its content size, so it can't shrink
        // below the masonry grid's full height) — overflow-y-auto then never
        // actually engages, the *page* grows past the viewport and scrolls
        // instead, and the fixed nav (pinned to the viewport, not this div)
        // ends up sitting over whatever card happens to reach its screen
        // position rather than over this div's own reserved bottom padding.
        // (LibraryFeed.tsx's equivalent div already has these — this was the
        // one place that didn't.)
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          // The extra var(--install-bar-reserve) term is 0px whenever
          // components/InstallPrompt.tsx isn't showing a bar (it clears the
          // property on unmount/hide) — see that file's setFeedBottomReserve.
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem + var(--install-bar-reserve, 0px))",
          }}
        >
          <MasonryGrid models={models} onRetry={handleRetry} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}
