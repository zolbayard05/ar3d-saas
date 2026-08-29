"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/Spinner";

// next/dynamic's `ssr: false` is only allowed inside a Client Component
// (Next 16 build error otherwise) — DesktopLanding.tsx itself is a Server
// Component (fetches the showcase row), so this thin "use client" wrapper
// is where the dynamic import actually lives. DesktopLandingViewer.tsx
// still needs it (rule 11 — @google/model-viewer's customElements.define()
// needs `window`), same reasoning ModelDetail.tsx/ResultStep.tsx already
// document for ARViewer, just one file further out here because the
// caller isn't itself a Client Component.
export const DesktopLandingViewerLoader = dynamic(
  () => import("@/components/DesktopLandingViewer").then((m) => m.DesktopLandingViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    ),
  },
);
