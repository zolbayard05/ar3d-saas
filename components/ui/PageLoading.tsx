import { Spinner } from "@/components/ui/Spinner";

/**
 * Shared body for every route segment's loading.tsx — Next.js renders this
 * automatically (wrapped in a Suspense boundary per segment) while that
 * segment's own Server Component data fetch is in flight, replacing what
 * was previously a blank screen during navigation. One component so every
 * segment's loading state looks and centers the same way, not five
 * hand-copied divs.
 */
export function PageLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
