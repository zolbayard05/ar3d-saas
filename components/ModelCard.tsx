"use client";

import { useState } from "react";
import Link from "next/link";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { MODEL_CARD_ASPECT_RATIO, buildModelUrl, formatDimensionsCm } from "@/lib/models";
import { deleteModel } from "@/lib/deleteModel";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface ModelCardProps {
  initialModel: ModelRow;
  onRetry: (model: ModelRow) => void;
  onDelete: (model: ModelRow) => void;
  /** Shows the pre-rendered 3D studio shot (render_url) instead of the
   * source photo for ready models. Started as HomeFeed-only (the curated
   * showcase); LibraryFeed opted in too (2026-09-02, "Миний Model" should
   * read the same way the showcase feed does) — a non-ready row just has
   * no render_url yet regardless of which feed it's in, so the fallback
   * below already covers that case without any extra branching here.
   * Defaults false so a future caller doesn't opt in by accident.
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

  // interactive3d (HomeFeed and now LibraryFeed too, see this file's own
  // comment): render_url for any row that has one. Falls back to the
  // source photo otherwise — every non-ready row (pending/processing/
  // failed) has no render_url yet by definition, so this fallback is the
  // normal path for those, not an edge case; a missing image is worse
  // than a wrong-but-present one.
  const thumbnailSrc =
    interactive3d && model.render_url
      ? buildModelUrl(model.render_url)
      : `/api/uploads/${model.source_image_key}`;
  const generating =
    model.status === "pending" || model.status === "processing";

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
          never triggers those variants.

          2026-09-03: fixed MODEL_CARD_ASPECT_RATIO instead of a per-card
          ratio derived from that card's own image (source photo width/
          height, or the render's bbox) — every card in the feed AND
          library is now the same size (product decision: consistency over
          the old masonry layout's variable heights), and the image inside
          is object-contain, not object-cover, so a shape that doesn't
          match the fixed box just letterboxes instead of getting cropped —
          the whole object/photo is always fully visible. bg-bg (flat, not
          a gradient) matches the reference screenshot this redesign was
          matched against: sampled pixel colors from actual card interiors
          there came back near-black (~rgb(1,1,1), i.e. this same token) —
          the warm glow visible in that reference is the PAGE background
          showing through the gaps between cards (MasonryGrid.tsx's
          --color-feed-glow), not each card's own background. */}
      <div
        className="relative overflow-hidden rounded-card border border-glass-border bg-bg shadow-glass-card transition-shadow duration-300 group-hover:border-glass-border-hover group-hover:shadow-glow-ring group-focus-visible:border-glass-border-hover group-focus-visible:shadow-glow-ring"
        style={{ aspectRatio: MODEL_CARD_ASPECT_RATIO }}
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
            "block size-full object-contain transition-opacity duration-300",
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
          // composites, a well-known mobile scroll-jank cause. Still true
          // here (2026-09-03, "liquid glass" request) — same tokens the
          // outer card border/shadow already use for its own "lit glass
          // surface" look (--color-glass-border, --shadow-glass-card's
          // inset top highlight) instead of a real blur: a lighter,
          // translucent bg-surface-hover fill reads as a glassy pill
          // against the image behind it without paying blur's per-card
          // compositing cost.
          <div className="absolute bottom-2 left-2 rounded-full border border-glass-border bg-surface-hover/60 px-1.5 py-0.5 shadow-glass-card">
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
