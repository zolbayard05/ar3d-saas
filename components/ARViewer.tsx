"use client";

import "@google/model-viewer";
import { buildModelUrl } from "@/lib/models";

export interface ARViewerProps {
  glbKey: string;
  usdzKey: string;
  scale: number;
  alt?: string;
}

/**
 * CLAUDE.md rule 11 — this file imports "@google/model-viewer" for its
 * customElements.define() side effect, which needs `window`. Callers MUST
 * bring this in via `next/dynamic(() => import("@/components/ARViewer"), {
 * ssr: false })`, never a plain import — a plain import runs this during
 * SSR and breaks the build. (See app/(app)/models/[id]/page.tsx for the
 * correct usage.)
 *
 * Rule 8's exact config: ar, ar-modes="webxr scene-viewer quick-look",
 * src = GLB, ios-src = USDZ.
 *
 * Rule 10's fallback: model-viewer's own AR button is known to grey out
 * after a prior iOS AR session until Safari's cache is cleared, with no way
 * for the user to tell why. The plain link below is independent of that
 * button's internal state — Safari launches AR Quick Look for a direct
 * navigation to a URL serving `.usdz` (rule 2's Content-Type is what makes
 * that recognition work) even without the rel="ar" banner treatment, so it
 * still works when the button doesn't. On Android/desktop it's a harmless
 * direct link to the file.
 *
 * Rule 9: no ar-status handling here beyond nothing — iOS AR is native
 * Quick Look, the user leaves the page, and there is no in-AR callback to
 * build against.
 */
export function ARViewer({ glbKey, usdzKey, scale, alt }: ARViewerProps) {
  const glbUrl = buildModelUrl(glbKey);
  const usdzUrl = buildModelUrl(usdzKey);
  const scaleAttr = `${scale} ${scale} ${scale}`;

  return (
    <div className="flex flex-col gap-3">
      <model-viewer
        src={glbUrl}
        ios-src={usdzUrl}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        scale={scaleAttr}
        alt={alt || "3D model"}
        shadow-intensity="1"
        className="aspect-square w-full rounded-card border border-border bg-surface"
      />
      <a
        href={usdzUrl}
        className="text-small text-text-muted underline underline-offset-2 hover:text-text"
      >
        AR button not responding? Tap here to open the model directly.
      </a>
    </div>
  );
}
