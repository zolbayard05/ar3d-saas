"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusStrip } from "@/components/StatusStrip";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { formatDimensionsCm } from "@/lib/models";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

// design/01-home-feed.png, design/06-feed-with-job.png. Real data end to
// end: dimensions, live status, retry, and a server-rendered studio
// thumbnail of the generated object itself (lib/renderThumbnail.ts) rather
// than the user's source photo.
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
        //
        // Two explicit flex-1 columns, not CSS `columns-2`: multi-column
        // layout doesn't guarantee equal rendered column widths (a real
        // browser quirk, confirmed visibly — the right column came out
        // wider than the left). Two flex siblings with matching flex-1 are
        // pixel-equal by construction, not by the browser's own balancing
        // heuristic. Cards alternate into left/right by index, each column
        // stacked with its own gap-2 for the vertical 8px spacing rule
        // 37 asks for (replacing break-inside-avoid/mb-2, which were
        // multi-column-specific and no longer apply).
        <div
          className="flex gap-2 overflow-y-auto px-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
        >
          {[0, 1].map((col) => (
            <div key={col} className="flex flex-1 flex-col gap-2">
              {models
                .filter((_, i) => i % 2 === col)
                .map((model) => (
                  <ModelCard key={model.id} initialModel={model} onRetry={handleRetry} />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelCard({ initialModel, onRetry }: { initialModel: ModelRow; onRetry: (model: ModelRow) => void }) {
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;

  // Always the source photo, never render_url: the studio render sits on
  // the same near-black backdrop as the page itself, so against --color-bg
  // the card reads as an empty rectangle rather than an object. The photo's
  // own background (white, a room, whatever it actually was) is what gives
  // the feed contrast and per-card variety. lib/renderThumbnail.ts and its
  // stored output are untouched — this only changes what the feed displays,
  // not whether the render pipeline runs or what's kept in R2/render_url.
  const thumbnailSrc = `/api/uploads/${model.source_image_key}`;

  // CLAUDE.md rule 37: the image fills its own rounded frame edge to edge —
  // no padding, no letterboxing, no card background showing behind it. A
  // plain w-full <img> at its natural (unforced) aspect ratio already IS
  // "cropped to the photo's own aspect ratio": the frame takes the image's
  // shape rather than imposing a different one, so no object-fit/crop math
  // is needed. Column-height variation from that is masonry's whole point
  // (rule 37) — never normalized to a fixed ratio.
  const content = (
    <div>
      <div className="relative overflow-hidden rounded-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnailSrc} alt="" className="block w-full bg-surface-hover" />
        {model.status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
            <p className="text-small uppercase tracking-wide text-text-muted">Couldn&apos;t generate</p>
          </div>
        )}
      </div>
      {/* Metadata sits OUTSIDE the rounded frame, directly on the page
          background — not overlaid on the photo, not inside a filled block
          (rule 37). No bg-* class here on purpose. */}
      <div className="flex flex-col gap-1 pt-2">
        <p className="text-body text-text">{model.title || "Untitled"}</p>
        <StatusLine model={model} onRetry={onRetry} />
      </div>
    </div>
  );

  if (model.status !== "ready") return content;

  return (
    <Link href={`/models/${model.id}`} className="block">
      {content}
    </Link>
  );
}

function StatusLine({ model, onRetry }: { model: ModelRow; onRetry: (model: ModelRow) => void }) {
  if (model.status === "ready") {
    const dims = formatDimensionsCm(model);
    return <p className="text-small uppercase tracking-wide text-text-muted">{dims}</p>;
  }

  if (model.status === "failed") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-small uppercase tracking-wide text-text-muted">Credit refunded</p>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onRetry(model);
          }}
          className="w-fit text-small uppercase tracking-wide text-text underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  return <GeneratingLine createdAt={model.created_at} />;
}

function GeneratingLine({ createdAt }: { createdAt: string }) {
  const elapsed = useElapsedTime(createdAt);
  return <p className="text-small uppercase tracking-wide text-text-muted">Generating · {elapsed}</p>;
}
