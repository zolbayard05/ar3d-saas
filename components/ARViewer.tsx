"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import "@google/model-viewer";
import { buildModelUrl } from "@/lib/models";
import { Spinner } from "@/components/ui/Spinner";

export interface ARViewerProps {
  glbKey: string;
  usdzKey: string;
  alt?: string;
  className?: string;
}

export interface ARViewerHandle {
  activateAR: () => void;
}

type ModelViewerElement = HTMLElement & {
  activateAR: () => Promise<void>;
  loaded: boolean;
};

/**
 * CLAUDE.md rule 11 — this file imports "@google/model-viewer" for its
 * customElements.define() side effect, which needs `window`. Every caller
 * MUST bring this in via `next/dynamic(() => import("@/components/ARViewer"), {
 * ssr: false })`, never a plain import — a plain import runs this during
 * SSR and breaks the build. Two call sites do this today (ModelDetail.tsx,
 * ResultStep.tsx) — the rule is "always via this pattern," not "only one
 * importer."
 *
 * Rule 8's exact config: ar, ar-modes="webxr scene-viewer quick-look",
 * src = GLB, ios-src = USDZ.
 *
 * No `scale` prop/attribute: the installed @google/model-viewer has no
 * `scale` property on the primary model at all (only on the unrelated
 * `<model-viewer-model>` multi-model child) — lib/glbScale.ts's header has
 * the full story. A model's chosen scale is baked directly into the GLB's
 * own geometry server-side (app/api/webhooks/tripo/route.ts's sizeModel,
 * app/api/models/rescale/route.ts for user-driven changes), so `src` is
 * already correct on arrival here and needs no runtime adjustment.
 *

 * The primary "View in your room" CTA lives in ModelDetail, not here — the
 * design (design/02-detail.png) puts it as a full-width bar below the
 * secondary-actions row, outside the square viewer's own box, which the
 * default ar-button slot (an absolutely-positioned overlay confined to the
 * viewer's bounds) can't produce. So ModelDetail's button calls
 * activateAR() — a public model-viewer method, not a hand-rolled anchor,
 * rule 7 is still about not hand-rolling the iOS rel="ar" anchor itself,
 * which this never touches. An empty slotted button suppresses model-viewer's
 * own default corner AR icon so there's exactly one visible AR trigger.
 */
export const ARViewer = forwardRef<ARViewerHandle, ARViewerProps>(
  function ARViewer({ glbKey, usdzKey, alt, className }, ref) {
    const viewerRef = useRef<ModelViewerElement>(null);
    const [loaded, setLoaded] = useState(false);

    useImperativeHandle(ref, () => ({
      activateAR: () => void viewerRef.current?.activateAR(),
    }));

    // model-viewer mounts and renders an empty/transparent canvas well before
    // the GLB itself has finished fetching — over the gradient backdrop that
    // reads as "there's no model here" rather than "still loading." Its own
    // "load" event is the real ready signal (fires once the asset is decoded
    // and about to be revealed), not the dynamic-import fallback one level up
    // in ModelDetail.tsx, which only covers the @google/model-viewer chunk
    // itself. The synchronous `.loaded` check right after attaching guards
    // the case where the model already finished (e.g. browser cache) before
    // this effect's listener could attach — same race ModelCard.tsx's image
    // ref callback exists to close.
    useEffect(() => {
      setLoaded(false);
      const el = viewerRef.current;
      if (!el) return;
      function onLoad() {
        setLoaded(true);
      }
      el.addEventListener("load", onLoad);
      if (el.loaded) setLoaded(true);
      return () => el.removeEventListener("load", onLoad);
    }, [glbKey]);

    const glbUrl = buildModelUrl(glbKey);
    const usdzUrl = buildModelUrl(usdzKey);

    return (
      <div className="relative">
        <model-viewer
          ref={viewerRef}
          src={glbUrl}
          ios-src={usdzUrl}
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          auto-rotate
          alt={alt || "3D model"}
          shadow-intensity="1"
          className={className}
          // Subtle radial gradient instead of a flat surface color so the model
          // has visual depth to sit against — tokens only (rule from
          // styles/tokens.css's header comment), no raw hex.
          style={{
            background:
              "radial-gradient(circle at 50% 38%, var(--color-surface-hover), var(--color-bg) 75%)",
          }}
        >
          <button
            slot="ar-button"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: "none" }}
          />
        </model-viewer>
        {/* Presence ring (2026-08-29) — a soft ambient glow near the base of
          the viewer, reinforcing "this object is floating in space" (the
          whole point of AR — see this file's own header comment). Model-
          viewer renders an opaque WebGL canvas filling its box, so this
          can't sit visually BEHIND the model inside that canvas; it's a
          later DOM sibling instead, painting on top at low opacity + blur,
          which reads as ambient light rather than obscuring anything.
          pointer-events-none so it never blocks the model's own
          orbit-drag/camera-controls interaction. animate-breathe (globals.css)
          is a slow 4s pulse — deliberately calmer than the fast
          Tailwind-builtin animate-pulse ModelCard.tsx uses for "actively
          generating", since this is decorative/ambient, not a status signal. */}
        {loaded && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-8 mx-auto h-1/4 w-2/3 animate-breathe rounded-full opacity-20 blur-xl lg:bottom-12"
            style={{
              background:
                "radial-gradient(ellipse at center, var(--color-text) 0%, transparent 70%)",
            }}
          />
        )}
        {!loaded && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Spinner size="lg" label="Model ачаалж байна" />
          </div>
        )}
      </div>
    );
  },
);
