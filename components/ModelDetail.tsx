"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Share2, Ruler, Image as ImageIcon, Download } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { ModelScaleControl } from "@/components/ModelScaleControl";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useModelScale } from "@/hooks/useModelScale";
import { buildModelUrl, formatDimensionsCm } from "@/lib/models";
import type { Database } from "@/lib/supabase/types";
import type { ARViewerHandle } from "@/components/ARViewer";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

// Rule 11 — the only place ARViewer may be imported. ssr:false keeps
// @google/model-viewer's customElements.define() out of the SSR pass
// entirely (it needs `window`, which doesn't exist there).
const ARViewer = dynamic(() => import("@/components/ARViewer").then((m) => m.ARViewer), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-square w-full items-center justify-center bg-surface">
      <Spinner size="lg" label="Loading viewer" />
    </div>
  ),
});

// design/02-detail.png. No app-name header (decision 3) — just back + share.
// The three secondary actions (scale, original photo, download) are
// icon+label only, muted, same visual register as everything else on the
// page; the AR button is the one high-contrast, full-width, bottom-docked
// element. That gap in weight is deliberate — Tripo's reference product
// treats AR as one of five equal icons, and that's exactly what this page
// must not do, since AR is the entire point of this product.
export function ModelDetail({ initialModel }: { initialModel: ModelRow }) {
  // Rule 14 — no polling. This is the one place the row's status/glb_url/
  // usdz_url ever change after the initial server-rendered fetch.
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;
  const [scale, setScale] = useModelScale(model.id, model.scale);
  const [scaleOpen, setScaleOpen] = useState(false);
  const arViewerRef = useRef<ARViewerHandle>(null);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: model.title || "3D model", url });
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  const ready = model.status === "ready" && model.glb_url && model.usdz_url;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <Link href="/dashboard" aria-label="Back to feed" className="text-text-muted hover:text-text">
          <ArrowLeft className="size-5" />
        </Link>
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share"
          className="text-text-muted hover:text-text"
        >
          <Share2 className="size-5" />
        </button>
      </div>

      {model.status === "failed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-body text-text">Generation failed.</p>
          {model.error && <p className="text-small text-text-muted">{model.error}</p>}
        </div>
      ) : !ready ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <Spinner size="lg" label="Generating model" />
          <p className="text-small text-text-muted">
            Generating your model — this usually takes 30 to 100 seconds.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <ARViewer
            ref={arViewerRef}
            glbKey={model.glb_url as string}
            usdzKey={model.usdz_url as string}
            scale={scale}
            alt={model.title ?? undefined}
            className="aspect-square w-full bg-surface"
          />

          <div className="flex flex-col gap-1 px-4 pt-4">
            <p className="text-heading font-semibold text-text">{model.title || "Untitled"}</p>
            {formatDimensionsCm(model) && (
              <p className="text-small uppercase tracking-wide text-text-muted">
                {formatDimensionsCm(model)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-around px-4 py-6">
            <button
              type="button"
              onClick={() => setScaleOpen((open) => !open)}
              aria-expanded={scaleOpen}
              className="flex flex-col items-center gap-2 text-text-muted hover:text-text"
            >
              <Ruler className="size-5" />
              <span className="text-small uppercase tracking-wide">Scale</span>
            </button>
            <a
              href={`/api/uploads/${model.source_image_key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 text-text-muted hover:text-text"
            >
              <ImageIcon className="size-5" />
              <span className="text-small uppercase tracking-wide">Original photo</span>
            </a>
            <a
              href={buildModelUrl(model.glb_url as string)}
              download
              className="flex flex-col items-center gap-2 text-text-muted hover:text-text"
            >
              <Download className="size-5" />
              <span className="text-small uppercase tracking-wide">Download</span>
            </a>
          </div>

          {scaleOpen && (
            <div className="px-4 pb-4">
              <ModelScaleControl scale={scale} onScaleChange={setScale} />
            </div>
          )}

          <div className="mt-auto flex flex-col">
            <button
              type="button"
              onClick={() => arViewerRef.current?.activateAR()}
              className="flex h-14 w-full items-center justify-center bg-accent text-body font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover"
            >
              View in your room
            </button>
            {/* Rule 10 — the AR button (default or, here, our custom one) can
                grey out after a prior iOS AR session until Safari's cache is
                cleared, with no way for the user to tell why. This link is
                independent of that button's internal state: Safari launches
                AR Quick Look for a direct navigation to a URL serving
                `.usdz` (rule 2's Content-Type is what makes that recognition
                work), so it still works when the button doesn't. No
                reference screen shows this — it must exist anyway. */}
            <a
              href={buildModelUrl(model.usdz_url as string)}
              className="px-4 py-2 text-center text-small text-text-muted underline underline-offset-2 hover:text-text"
            >
              AR button not responding? Tap here to open the model directly.
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
