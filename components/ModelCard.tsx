"use client";

import { useState } from "react";
import Link from "next/link";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { DEFAULT_SOURCE_ASPECT_RATIO, formatDimensionsCm } from "@/lib/models";
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
  // Only a genuinely pending/processing card needs a live channel — see
  // useModelRealtime's own comment. A ready/failed card (the overwhelming
  // majority in a populated feed) gets a static snapshot with zero
  // WebSocket overhead, since its fields can never change again.
  const live =
    initialModel.status === "pending" || initialModel.status === "processing";
  const model =
    useModelRealtime(initialModel.id, initialModel, { live }) ?? initialModel;
  const [imageLoaded, setImageLoaded] = useState(false);

  // Always the source photo, never render_url: the studio render sits on
  // the same near-black backdrop as the page itself, so against --color-bg
  // the card reads as an empty rectangle rather than an object. The photo's
  // own background (white, a room, whatever it actually was) is what gives
  // the feed contrast and per-card variety. lib/renderThumbnail.ts and its
  // stored output are untouched — this only changes what's displayed, not
  // whether the render pipeline runs or what's kept in R2/render_url.
  const thumbnailSrc = `/api/uploads/${model.source_image_key}`;
  const generating =
    model.status === "pending" || model.status === "processing";

  // Reserved up front from the same stored aspect ratio MasonryGrid.tsx
  // already uses to balance columns (migration 0012) — an <img> with no
  // intrinsic size renders at 0 height until it's actually downloaded, so
  // every card in the grid collapses to just its title on first paint, then
  // jumps to full size later, shoving everything below it down at a random
  // moment per card. Setting aspect-ratio up front makes the frame its real
  // final size on the very first paint (filled with bg-surface-hover as a
  // placeholder), so there's nothing left to shift — only a fade once the
  // image itself is actually in. object-cover (not the old bare w-full)
  // because the reserved box is now sized from stored data, not from
  // whatever the image's own natural size happens to render at, so a row
  // that fell back to DEFAULT_SOURCE_ASPECT_RATIO (no stored ratio) needs
  // cropping rather than distortion to fill that box cleanly.
  const aspectRatio =
    model.source_image_width && model.source_image_height
      ? model.source_image_width / model.source_image_height
      : DEFAULT_SOURCE_ASPECT_RATIO;
  const dims = model.status === "ready" ? formatDimensionsCm(model) : null;

  const content = (
    <div>
      {/* border-glass-border + shadow-glass-card (2026-08-29, glow/glass
          redesign — see the published design proposal): a glass hairline
          border plus an inset top highlight instead of the previous flat
          border-border-subtle fill, so the card reads as a lit surface
          rather than a flat block. group-hover/group-focus-visible only
          matter for ready models (wrapped in a Link with the "group" class
          below) — a non-ready card has nothing to hover into, so it just
          never triggers those variants. */}
      <div
        className="relative overflow-hidden rounded-card border border-glass-border bg-surface-hover shadow-glass-card transition-shadow duration-300 group-hover:border-glass-border-hover group-hover:shadow-glow-ring group-focus-visible:border-glass-border-hover group-focus-visible:shadow-glow-ring"
        style={{ aspectRatio }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailSrc}
          alt=""
          loading="lazy"
          decoding="async"
          // React's onLoad prop alone isn't enough here, for two separate
          // reasons that both leave imageLoaded stuck false and the image
          // stuck at opacity-0 forever (both caught live, not theoretical):
          // (1) an image the browser already had cached can fire `load`
          // before the listener is even attached; (2) with loading="lazy"
          // added, the browser defers starting the fetch until its own
          // (React-uncontrolled) heuristic decides to — by the time that
          // happens, node.complete can flip true, or `load` can fire, at a
          // point this ref callback (which only ever ran once, at mount)
          // has long since stopped checking. Fix for both: attach a real
          // native listener imperatively, which catches the event whenever
          // the browser actually dispatches it, plus an immediate check for
          // the already-complete-at-attach case (re-runs on every mount,
          // including the lazy image's own deferred one).
          ref={(node) => {
            if (!node) return;
            if (node.complete) {
              setImageLoaded(true);
              return;
            }
            node.addEventListener("load", () => setImageLoaded(true), {
              once: true,
            });
          }}
          className={cn(
            "block size-full object-cover transition-opacity duration-300",
            !imageLoaded && "opacity-0",
            imageLoaded && !generating && "opacity-100",
            imageLoaded && generating && "opacity-50",
          )}
        />
        {generating && (
          <>
            {/* Pulsing app-mark centered over the dimmed photo — the "this
                is actively working" signal (Tripo's reference uses a
                generic rotating cube in the same spot; ours is the app's
                own icon instead of a generic placeholder). A pulse, not a
                spin: a monogram keeps its letterform readable at rest,
                which a continuously-rotating "R" wouldn't. */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-192.png"
                alt=""
                className="size-12 animate-pulse rounded-md"
              />
            </div>
            {/* Thin indeterminate progress line — Tripo gives us start/complete
                events, never a real percentage, so an animated-but-unspecific
                bar is the honest representation, not a fabricated number. */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-surface-hover">
              <div className="h-full w-1/3 animate-pulse bg-text" />
            </div>
          </>
        )}
        {model.status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
            <p className="text-small uppercase tracking-wide text-text-muted">
              Үүсгэж чадсангүй
            </p>
          </div>
        )}
        {dims && (
          // backdrop-blur-md removed (2026-08-29) — backdrop-filter forces
          // a real-time blur of everything behind each instance; with a
          // few dozen cards in an unvirtualized masonry grid (see
          // MasonryGrid.tsx), that's a few dozen simultaneous backdrop
          // composites, a well-known mobile scroll-jank cause. bg-bg/80 is
          // opaque enough on its own that the blur wasn't buying much
          // legibility anyway.
          <div className="absolute bottom-2 left-2 rounded-full border border-glass-border bg-bg/80 px-2.5 py-1">
            <p className="text-small uppercase tracking-wide text-text">
              {dims}
            </p>
          </div>
        )}
      </div>
      {/* Metadata sits OUTSIDE the rounded frame, directly on the page
          background — not overlaid on the photo, not inside a filled block
          (rule 37). No bg-* class here on purpose. Dimensions render as the
          on-image chip above, not a second line here. */}
      <div className="flex flex-col gap-1 pt-2">
        <p className="text-body text-text">{model.title || "Нэргүй"}</p>
        {model.status !== "ready" && (
          <StatusLine model={model} onRetry={onRetry} onDelete={onDelete} />
        )}
      </div>
    </div>
  );

  if (model.status !== "ready") return content;

  return (
    <Link href={`/models/${model.id}`} className="group block">
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
        <p className="text-small uppercase tracking-wide text-text-muted">
          Кредит буцаагдсан
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onRetry(model);
            }}
            className="w-fit text-small uppercase tracking-wide text-text underline underline-offset-2"
          >
            Дахин оролдох
          </button>
          <button
            type="button"
            onClick={async (event) => {
              event.preventDefault();
              if (await deleteModel(model.id)) onDelete(model);
            }}
            className="w-fit text-small uppercase tracking-wide text-text-muted underline underline-offset-2 hover:text-text"
          >
            Устгах
          </button>
        </div>
      </div>
    );
  }

  return <GeneratingLine createdAt={model.created_at} />;
}

function GeneratingLine({ createdAt }: { createdAt: string }) {
  const elapsed = useElapsedTime(createdAt);
  return (
    <p className="text-small uppercase tracking-wide text-text-muted">
      Үүсгэж байна · {elapsed}
    </p>
  );
}
