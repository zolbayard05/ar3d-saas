"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/Spinner";
import { ModelScaleControl } from "@/components/ModelScaleControl";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useModelScale } from "@/hooks/useModelScale";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

// Rule 11 — the only place ARViewer may be imported. ssr:false keeps
// @google/model-viewer's customElements.define() out of the SSR pass
// entirely (it needs `window`, which doesn't exist there).
const ARViewer = dynamic(() => import("@/components/ARViewer").then((m) => m.ARViewer), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-square w-full items-center justify-center rounded-card border border-border bg-surface">
      <Spinner size="lg" label="Loading viewer" />
    </div>
  ),
});

export function ModelDetail({ initialModel }: { initialModel: ModelRow }) {
  // Rule 14 — no polling. This is the one place the row's status/glb_url/
  // usdz_url ever change after the initial server-rendered fetch.
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;
  const [scale, setScale] = useModelScale(model.id, model.scale);

  if (model.status === "failed") {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-6">
        <p className="text-body text-text">Generation failed.</p>
        {model.error && <p className="text-small text-text-muted">{model.error}</p>}
      </div>
    );
  }

  if (model.status !== "ready" || !model.glb_url || !model.usdz_url) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface">
        <Spinner size="lg" label="Generating model" />
        <p className="text-small text-text-muted">
          Generating your model — this usually takes 30 to 100 seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <ARViewer glbKey={model.glb_url} usdzKey={model.usdz_url} scale={scale} alt={model.title ?? undefined} />
      <ModelScaleControl scale={scale} onScaleChange={setScale} />
    </div>
  );
}
