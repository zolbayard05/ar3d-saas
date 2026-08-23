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
