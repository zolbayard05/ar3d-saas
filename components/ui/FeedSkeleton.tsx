// Loading-state stand-in for HomeFeed/LibraryFeed's MasonryGrid (rule 40 —
// mirrors its exact structure: two flex-1 columns, gap-2 px-2, rounded-card
// tiles) rather than a generic centered spinner (components/ui/PageLoading)
// — a content-shaped placeholder reads as "the feed is arriving" instead of
// "something is happening, wait and see." Fixed aspect ratios per slot
// (not random) so the skeleton itself never shifts between renders.
const COLUMN_ASPECTS: [number, number][] = [
  [4 / 5, 1],
  [1, 3 / 4],
  [3 / 4, 4 / 5],
];

export function FeedSkeleton() {
  return (
    <div className="flex gap-2 px-2 pt-1">
      {([0, 1] as const).map((col) => (
        <div key={col} className="flex flex-1 flex-col gap-2">
          {COLUMN_ASPECTS.map((pair, row) => (
            <div key={row} className="flex flex-col gap-2">
              <div
                className="animate-pulse rounded-card bg-surface-hover"
                style={{ aspectRatio: pair[col] }}
              />
              <div className="h-3 w-2/3 animate-pulse rounded-sm bg-surface-hover" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
