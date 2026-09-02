"use client";

import { useState } from "react";
import Link from "next/link";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { DEFAULT_SOURCE_ASPECT_RATIO, buildModelUrl, formatDimensionsCm } from "@/lib/models";
import { deleteModel } from "@/lib/deleteModel";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface ModelCardProps {
  initialModel: ModelRow;
  onRetry: (model: ModelRow) => void;
  onDelete: (model: ModelRow) => void;
  /** Curated showcase feed only (HomeFeed) — shows the pre-rendered 3D
   * studio shot (render_url) instead of the source photo for ready models.
   * Library keeps the photo (mixed personal statuses, not a curated
   * ready-only showcase — see HomeFeed.tsx's own "pure showcase" comment).
   * Defaults false so every existing caller (LibraryFeed) is unaffected.
   *
   * REVISED 2026-09-02: this briefly rendered a *live*, auto-rotating GLB
   * per card (FeedModelViewer, now deleted) instead of a static image.
   * Reverted after a live report: several showcase cards on screen at once
   * opened that many real WebGL contexts, and mobile browsers have a low
   * per-tab context ceiling — once exceeded, EXISTING contexts silently go
   * gray/lost, not just new ones refused, which is why a refresh "fixed"
   * it (fresh contexts, same ceiling, same eventual failure once enough
   * cards scrolled through). render_url is a plain <img> — zero live GPU
   * cost — and was already being generated for every ready model
   * regardless (lib/renderThumbnail.ts, via the webhook's
   * renderAndStoreThumbnail); this only changes what gets *displayed*. */
  interactive3d?: boolean;
}

// CLAUDE.md rule 40 — the one card component every screen's masonry uses
// (dashboard feed, library). Extracted out of components/HomeFeed.tsx so
// library reuses this directly rather than a parallel copy.
export function ModelCard({ initialModel, onRetry, onDelete, interactive3d = false }: ModelCardProps) {
  // Only a genuinely pending/processing card needs a live channel — see
  // useModelRealtime's own comment. A ready/failed card (the overwhelming
  // majority in a populated feed) gets a static snapshot with zero
  // WebSocket overhead, since its fields can never change again.
  const live =
    initialModel.status === "pending" || initialModel.status === "processing";
  const model =
    useModelRealtime(initialModel.id, initialModel, { live }) ?? initialModel;
  const [imageLoaded, setImageLoaded] = useState(false);

  // Library (interactive3d=false): always the source photo, never
  // render_url — the studio render sits on the same near-black backdrop as
  // the page itself, so against --color-bg the card reads as an empty
  // rectangle rather than an object; the photo's own background (white, a
  // room, whatever it actually was) is what gives that feed contrast and
  // per-card variety.
  //
  // HomeFeed (interactive3d=true): render_url instead — see this file's
  // interactive3d comment for why a static 3D render replaced a live
  // viewer here. Falls back to the source photo only if a showcase row
  // somehow has no render yet (shouldn't happen — see that same comment —
  // but a missing image is worse than a wrong-but-present one).
  const thumbnailSrc =
    interactive3d && model.render_url
      ? buildModelUrl(model.render_url)
      : `/api/uploads/${model.source_image_key}`;
  const generating =
    model.status === "pending" || model.status === "processing";

  // Reserved up front from a stored aspect ratio — an <img> with no
  // intrinsic size renders at 0 height until it's actually downloaded, so
  // every card in the grid collapses to just its title on first paint, then
  // jumps to full size later, shoving everything below it down at a random
  // moment per card. Setting aspect-ratio up front makes the frame its real
  // final size on the very first paint (filled with bg-surface-hover as a
  // placeholder), so there's nothing left to shift — only a fade once the
  // image itself is actually in. object-cover (not the old bare w-full)
  // relies on the box's aspect ratio actually matching the image's, or it
  // crops into the subject instead of just filling the box cleanly.
  //
  // thumbnailSrc's TWO possible images have different real aspect ratios,
  // so which stored ratio backs the box has to match: render_url (the
  // interactive3d/HomeFeed case) is lib/renderThumbnail.ts's own studio
  // render, framed edge-to-edge around the GLB's bbox at exactly
  // bbox_width_m/bbox_height_m (scale-invariant — both dimensions scale by
  // the same factor, so this ratio is right regardless of the model's
  // scale) — using source_image_width/height there instead (the ORIGINAL
  // PHOTO's shape, unrelated to the render's) was the bug: most objects'
  // photo crop and rendered-object silhouette aren't the same shape, so
  // object-cover was cropping into the render to force it into a box sized
  // for a different image entirely, reading as models "cut off on the
  // sides" (reported 2026-09-02). The source-photo case (library/non-3d)
  // is unaffected — that ratio is still correct for that image.
  const usingRender = interactive3d && Boolean(model.render_url);
  const aspectRatio =
    usingRender && model.bbox_width_m && model.bbox_height_m
      ? model.bbox_width_m / model.bbox_height_m
      : model.source_image_width && model.source_image_height
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
          on-image chip above, not a second line here. No title line either
          (2026-09-02 product decision: models have no name at all, not even
          a placeholder). */}
      {model.status !== "ready" && (
        <div className="pt-2">
          <StatusLine model={model} onRetry={onRetry} onDelete={onDelete} />
        </div>
      )}
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
