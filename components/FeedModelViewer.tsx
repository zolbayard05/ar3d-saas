"use client";

import "@google/model-viewer";
import { buildModelUrl } from "@/lib/models";

export interface FeedModelViewerProps {
  glbKey: string;
  poster?: string;
  alt?: string;
  className?: string;
}

/**
 * CLAUDE.md rule 11 — imports "@google/model-viewer" for its
 * customElements.define() side effect, which needs `window`. Callers MUST
 * bring this in via `next/dynamic(() => import("@/components/FeedModelViewer"),
 * { ssr: false })`, never a plain import (same rule ARViewer.tsx's own header
 * comment documents — this is a second, deliberately separate call site, not
 * a merge into that one, see below for why).
 *
 * A stripped-down sibling of ARViewer.tsx, not a reuse of it: this mounts
 * inside a scrolling masonry feed (ModelCard.tsx, when `interactive3d` is
 * on), where ARViewer's `camera-controls` would capture the drag gesture a
 * visitor uses to scroll the page — fine on the dedicated /models/[id]
 * page ARViewer actually lives on, wrong here. No AR button either — the
 * card is already a Link to that same detail page, which is where the real
 * "View in your room" action lives (rule 7/8).
 *
 * `loading="lazy"` mirrors ModelCard's own `<img loading="lazy">` for the
 * non-3D case: a showcase feed can have several of these on screen at
 * once, and each one is a real WebGL context — only fetching/initializing
 * once a card actually scrolls near the viewport keeps that bounded,
 * exactly like the image path already does for network requests.
 */
export function FeedModelViewer({ glbKey, poster, alt, className }: FeedModelViewerProps) {
  const glbUrl = buildModelUrl(glbKey);

  return (
    <model-viewer
      src={glbUrl}
      poster={poster}
      loading="lazy"
      reveal="auto"
      auto-rotate
      alt={alt || "3D model"}
      className={className}
      style={{ background: "transparent" }}
    />
  );
}
