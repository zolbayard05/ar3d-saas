"use client";

import { useColumnCount } from "@/hooks/useColumnCount";
import { MODEL_CARD_ASPECT_RATIO } from "@/lib/models";

// Loading-state stand-in for HomeFeed/LibraryFeed's MasonryGrid (rule 40 —
// mirrors its exact structure: same grid-template-columns/gap/px, same
// MODEL_CARD_ASPECT_RATIO tiles) rather than a generic centered spinner
// (components/ui/PageLoading) — a content-shaped placeholder reads as "the
// feed is arriving" instead of "something is happening, wait and see."
// Every tile is the same fixed ratio (2026-09-03: real cards are too, no
// longer masonry) and there's no title line under each tile since
// ModelCard no longer shows one either.
const SKELETON_TILE_COUNT = 9;

export function FeedSkeleton() {
  const columnCount = useColumnCount();

  return (
    <div
      className="grid gap-2 px-2 pt-1"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: SKELETON_TILE_COUNT }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-card bg-surface-hover"
          style={{ aspectRatio: MODEL_CARD_ASPECT_RATIO }}
        />
      ))}
    </div>
  );
}
