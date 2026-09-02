/**
 * Client-safe (no server-only import) — used from both Server and Client
 * Components to turn a stored R2 key (see app/api/webhooks/tripo/route.ts)
 * into a fetchable URL.
 *
 * The whole point of this indirection: NEXT_PUBLIC_MODELS_CDN_URL is the
 * single place that changes when the real domain goes live (rule 4 — never
 * point this at *.r2.dev). Until then it points at the local dev proxy
 * (app/api/models/[...key]/route.ts) instead — swapping to
 * https://cdn.<domain> later is a one-line env var change, nothing here.
 */
export function buildModelUrl(key: string): string {
  const prefix = process.env.NEXT_PUBLIC_MODELS_CDN_URL || "/api/models";
  return `${prefix.replace(/\/$/, "")}/${key}`;
}

/**
 * The feed's metadata line: "W x D x H CM", uppercase, wide-tracked (see
 * CLAUDE.md's decision log). Multiplies the raw bounding box (migration
 * 0008 — the mesh's own unscaled units, NOT real centimeters on their own,
 * per rule 22) by the model's own `scale` — the one real, user-adjustable
 * number here — so what's shown is honest and updates live if the user
 * changes scale, not a fabricated absolute measurement.
 *
 * Returns null (render nothing) rather than "0 x 0 x 0 CM" for models from
 * before migration 0008, or where bbox extraction failed — see
 * lib/glbCompress.ts's catch.
 */
// MasonryGrid.tsx and ModelCard.tsx: cards without a stored aspect ratio
// (pre-migration-0012 rows, or a client-side decode failure) fall back to
// this rather than guessing wildly — a common-ish "landscape product
// photo" ratio, not 1:1 (most captured objects are wider than tall in
// frame) and not extreme. Exported so both files derive it from the same
// number rather than two copies that could drift.
export const DEFAULT_SOURCE_ASPECT_RATIO = 4 / 3;

// Arbitrary but consistent — every card uses the same assumed column width,
// so it cancels out in the relative comparison MasonryGrid actually does
// (which column's running total is smaller), regardless of the real
// rendered pixel width.
const ASSUMED_COLUMN_WIDTH_PX = 200;

// Rough constant for the metadata row below the image (title, and for a
// non-ready card the status line) — deliberately not trying to model the
// real variance between a one-line "ready" title and a two-line "failed"
// status block; the image aspect ratio already dominates the estimate, this
// just keeps very-square photos from being weighted as if they had zero
// metadata footprint.
const METADATA_ROW_HEIGHT_PX = 48;

/**
 * Expected rendered card height in the feed, from data already on the row —
 * no post-render measurement. See MasonryGrid.tsx for why this needs to be
 * knowable before placement, not after.
 */
/**
 * Must mirror ModelCard.tsx's own `aspectRatio` calc exactly — that's the
 * ratio the card's box is actually rendered at, so an estimate from a
 * different one (e.g. always the source photo, even for a showcase card
 * that displays render_url instead) throws MasonryGrid's column-balancing
 * off by however much those two images' shapes differ.
 */
export function estimateCardHeight(model: {
  source_image_width: number | null;
  source_image_height: number | null;
  bbox_width_m: number | null;
  bbox_height_m: number | null;
  render_url: string | null;
}, interactive3d: boolean): number {
  const usingRender = interactive3d && Boolean(model.render_url);
  const aspect =
    usingRender && model.bbox_width_m && model.bbox_height_m
      ? model.bbox_width_m / model.bbox_height_m
      : model.source_image_width && model.source_image_height
        ? model.source_image_width / model.source_image_height
        : DEFAULT_SOURCE_ASPECT_RATIO;
  return ASSUMED_COLUMN_WIDTH_PX / aspect + METADATA_ROW_HEIGHT_PX;
}

export function formatDimensionsCm(model: {
  bbox_width_m: number | null;
  bbox_depth_m: number | null;
  bbox_height_m: number | null;
  scale: number;
}): string | null {
  const { bbox_width_m, bbox_depth_m, bbox_height_m, scale } = model;
  if (bbox_width_m == null || bbox_depth_m == null || bbox_height_m == null) return null;
  const cm = (m: number) => Math.round(m * scale * 100);
  return `${cm(bbox_width_m)} × ${cm(bbox_depth_m)} × ${cm(bbox_height_m)} CM`;
}
