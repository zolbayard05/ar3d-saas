// Loading-state stand-in for ModelDetail's two-pane layout (viewer +
// info column, components/ModelDetail.tsx) — same principle as
// components/ui/FeedSkeleton.tsx (a content-shaped placeholder instead of
// a generic centered spinner), mirroring THIS page's actual shape rather
// than reusing FeedSkeleton's masonry-grid one, which doesn't apply here
// (one model, not a list of cards).
export function DetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-12 shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-feed lg:flex-row lg:items-start lg:gap-10 lg:px-6 lg:pt-6">
        <div className="aspect-[4/5] w-full animate-pulse bg-surface-hover lg:flex-1 lg:rounded-card" />

        <div className="flex flex-col gap-6 px-4 pt-4 lg:w-96 lg:flex-none lg:px-0">
          <div className="flex flex-col gap-2">
            <div className="h-6 w-2/3 animate-pulse rounded-sm bg-surface-hover" />
            <div className="h-3 w-1/3 animate-pulse rounded-sm bg-surface-hover" />
          </div>
          <div className="flex items-center justify-around lg:justify-start lg:gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="size-5 animate-pulse rounded-sm bg-surface-hover" />
            ))}
          </div>
          <div className="mt-auto h-14 w-full animate-pulse rounded-full bg-surface-hover" />
        </div>
      </div>
    </div>
  );
}
