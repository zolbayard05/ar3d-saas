"use client";

import { useElapsedTime } from "@/hooks/useElapsedTime";

export interface StatusStripProps {
  createdAt: string;
  onView?: () => void;
}

// design/06-feed-with-job.png: sits below the header (CLAUDE.md rule 38),
// above the feed, only while a job is active. Wired to a real ticking
// elapsed time, not the design's static "1:12".
export function StatusStrip({ createdAt, onView }: StatusStripProps) {
  const elapsed = useElapsedTime(createdAt);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-bg px-4">
      <p className="text-small font-semibold uppercase tracking-wide text-text">
        Building your model · {elapsed}
      </p>
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="text-small uppercase tracking-wide text-text-muted hover:text-text"
        >
          View
        </button>
      )}
    </div>
  );
}
