"use client";

import { useEffect, useRef, useState } from "react";
import "@google/model-viewer";
import { buildModelUrl } from "@/lib/models";
import { Spinner } from "@/components/ui/Spinner";

export interface DesktopLandingViewerProps {
  glbKey: string;
  alt?: string;
  className?: string;
}

type ModelViewerElement = HTMLElement & { loaded: boolean };

/**
 * The desktop landing's hero — same @google/model-viewer dependency
 * ARViewer.tsx already uses (rule 11: dynamically imported client-only via
 * next/dynamic({ ssr: false }) by the caller, same window/custom-element
 * constraint applies here even though this isn't AR-specific), just
 * without any `ar`/`ar-modes` attribute: a desktop visitor can't launch
 * AR, so this is a plain interactive/auto-rotating viewer, not a
 * cut-down AR one.
 *
 * Showing one of the app's own real generated models (not a stock 3D
 * asset) is the whole marketing pitch made literal: this is what the
 * product actually produces.
 */
export function DesktopLandingViewer({ glbKey, alt, className }: DesktopLandingViewerProps) {
  const viewerRef = useRef<ModelViewerElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    function onLoad() {
      setLoaded(true);
    }
    el.addEventListener("load", onLoad);
    if (el.loaded) setLoaded(true);
    return () => el.removeEventListener("load", onLoad);
  }, [glbKey]);

  // Restrained scroll-linked camera move (2026 3D-landing research: motion
  // should support the headline/CTA, not compete with it) — nudges
  // field-of-view a few degrees as the hero scrolls toward/out of view,
  // instead of a hard cut or a busy multi-axis animation. field-of-view
  // isn't in types/model-viewer.d.ts's typed JSX props (that file only
  // covers what ARViewer.tsx needs), so it's set imperatively here rather
  // than widening a shared ambient type for one caller.
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, 1 - rect.top / window.innerHeight));
      el.setAttribute("field-of-view", `${30 + progress * 8}deg`);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const glbUrl = buildModelUrl(glbKey);

  return (
    <div className="relative">
      <model-viewer
        ref={viewerRef}
        src={glbUrl}
        camera-controls
        auto-rotate
        alt={alt || "3D model"}
        shadow-intensity="1"
        className={className}
        style={{
          background:
            "radial-gradient(circle at 50% 38%, var(--color-surface-hover), var(--color-bg) 75%)",
        }}
      />
      {/* Presence-ring idiom reused from ARViewer.tsx's own hero shot,
          same animate-breathe timing (app/globals.css) — an ambient glow
          under the model rather than a second, unrelated effect. */}
      {loaded && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-8 mx-auto h-1/4 w-2/3 animate-breathe rounded-full opacity-20 blur-xl"
          style={{
            background: "radial-gradient(ellipse at center, var(--color-text) 0%, transparent 70%)",
          }}
        />
      )}
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  );
}
