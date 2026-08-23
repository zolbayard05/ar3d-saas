"use client";

import Link from "next/link";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { formatDimensionsCm } from "@/lib/models";
import { deleteModel } from "@/lib/deleteModel";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface ModelCardProps {
  initialModel: ModelRow;
  onRetry: (model: ModelRow) => void;
  onDelete: (model: ModelRow) => void;
}

// CLAUDE.md rule 40 — the one card component every screen's masonry uses
// (dashboard feed, library). Extracted out of components/HomeFeed.tsx so
// library reuses this directly rather than a parallel copy.
export function ModelCard({ initialModel, onRetry, onDelete }: ModelCardProps) {
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;

  // Always the source photo, never render_url: the studio render sits on
  // the same near-black backdrop as the page itself, so against --color-bg
  // the card reads as an empty rectangle rather than an object. The photo's
  // own background (white, a room, whatever it actually was) is what gives
  // the feed contrast and per-card variety. lib/renderThumbnail.ts and its
  // stored output are untouched — this only changes what's displayed, not
  // whether the render pipeline runs or what's kept in R2/render_url.
  const thumbnailSrc = `/api/uploads/${model.source_image_key}`;
  const generating = model.status === "pending" || model.status === "processing";

  // CLAUDE.md rule 37: the image fills its own rounded frame edge to edge —
  // no padding, no letterboxing, no card background showing behind it. A
  // plain w-full <img> at its natural (unforced) aspect ratio already IS
  // "cropped to the photo's own aspect ratio": the frame takes the image's
  // shape rather than imposing a different one, so no object-fit/crop math
  // is needed. Column-height variation from that is masonry's whole point
  // — never normalized to a fixed ratio.
  const dims = model.status === "ready" ? formatDimensionsCm(model) : null;

  const content = (
    <div>
      <div className="relative overflow-hidden rounded-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailSrc}
          alt=""
          className={cn("block w-full bg-surface-hover", generating && "opacity-50")}
        />
        {generating && (
          // Thin indeterminate progress line — Tripo gives us start/complete
          // events, never a real percentage, so an animated-but-unspecific
          // bar is the honest representation, not a fabricated number.
          <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-surface-hover">
            <div className="h-full w-1/3 animate-pulse bg-text" />
          </div>
        )}
        {model.status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
            <p className="text-small uppercase tracking-wide text-text-muted">Couldn&apos;t generate</p>
          </div>
        )}
        {dims && (
          <div className="absolute bottom-2 left-2 rounded-full bg-bg/80 px-2.5 py-1">
            <p className="text-small uppercase tracking-wide text-text">{dims}</p>
          </div>
        )}
      </div>
      {/* Metadata sits OUTSIDE the rounded frame, directly on the page
          background — not overlaid on the photo, not inside a filled block
          (rule 37). No bg-* class here on purpose. Dimensions render as the
          on-image chip above, not a second line here. */}
      <div className="flex flex-col gap-1 pt-2">
        <p className="text-body text-text">{model.title || "Untitled"}</p>
        {model.status !== "ready" && <StatusLine model={model} onRetry={onRetry} onDelete={onDelete} />}
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

// Only ever called for a non-ready model — the ready case renders its
// dimensions as the on-image chip instead (see above).
function StatusLine({
  model,
  onRetry,
  onDelete,
}: {
  model: ModelRow;
  onRetry: (model: ModelRow) => void;
  onDelete: (model: ModelRow) => void;
}) {
  if (model.status === "failed") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-small uppercase tracking-wide text-text-muted">Credit refunded</p>
        <div className="flex items-center gap-3">
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
          <button
            type="button"
            onClick={async (event) => {
              event.preventDefault();
              if (await deleteModel(model.id)) onDelete(model);
            }}
            className="w-fit text-small uppercase tracking-wide text-text-muted underline underline-offset-2 hover:text-text"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return <GeneratingLine createdAt={model.created_at} />;
}

function GeneratingLine({ createdAt }: { createdAt: string }) {
  const elapsed = useElapsedTime(createdAt);
  return <p className="text-small uppercase tracking-wide text-text-muted">Generating · {elapsed}</p>;
}
