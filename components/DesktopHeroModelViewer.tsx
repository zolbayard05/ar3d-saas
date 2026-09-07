"use client";

import { useEffect, useRef } from "react";
import "@google/model-viewer";

export interface DesktopHeroModelViewerProps {
  src: string;
  alt: string;
  className?: string;
  /** Fires once model-viewer's own native "load" event fires — lets a caller (e.g. DesktopCategoriesSection's hover crossfade) know the model is actually ready to show, not just mounted. */
  onLoad?: () => void;
}

/**
 * A plain local-file <model-viewer> for the hero's sneaker/backpack beats —
 * distinct from ARViewer.tsx, which resolves R2-hosted user models via
 * buildModelUrl(key); these are static /public assets, so `src` is used
 * directly. Same rule-11 requirement applies: this file's top-level
 * "@google/model-viewer" import touches `window` at module load, so every
 * caller MUST bring it in via next/dynamic(..., { ssr: false }), same as
 * ARViewer.tsx's own callers.
 *
 * The library sets pointer-events: auto on itself internally (its shadow-
 * DOM :host rule, needed so camera-controls works regardless of the
 * consumer page's CSS) — that wins over anything set on an ancestor.
 * DesktopHeroTumble reaches past this with a direct DOM query
 * (querySelector("model-viewer")) rather than a ref threaded through
 * next/dynamic, which doesn't reliably forward refs to a lazily-loaded
 * component.
 */
export function DesktopHeroModelViewer({ src, alt, className, onLoad }: DesktopHeroModelViewerProps) {
  const ref = useRef<HTMLElement>(null);

  // React's JSX onLoad prop maps to a real native-event listener only for
  // elements React itself recognizes (<img>, <iframe>, ...) — for a custom
  // element like <model-viewer>, it's silently a no-op (confirmed live:
  // model-viewer.loaded flipped true but the onLoad prop never fired).
  // addEventListener directly on the element is what actually works.
  useEffect(() => {
    const el = ref.current;
    if (!el || !onLoad) return;
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [onLoad]);

  return (
    <model-viewer
      ref={ref}
      src={src}
      alt={alt}
      camera-controls
      auto-rotate
      auto-rotate-delay={0}
      rotation-per-second="18deg"
      disable-zoom
      shadow-intensity="1"
      interaction-prompt="none"
      className={className}
      style={{ background: "transparent" }}
    />
  );
}
