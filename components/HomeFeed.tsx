"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusStrip } from "@/components/StatusStrip";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { buildModelUrl, formatDimensionsCm } from "@/lib/models";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

// design/01-home-feed.png, design/06-feed-with-job.png. Real data end to
// end: dimensions, live status, retry, and a server-rendered studio
// thumbnail of the generated object itself (lib/renderThumbnail.ts) rather
// than the user's source photo.
export function HomeFeed({ initialModels }: { initialModels: ModelRow[] }) {
  const [models, setModels] = useState(initialModels);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function handleRetry(model: ModelRow) {
    setRetryError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageKey: model.source_image_key, idempotencyKey: crypto.randomUUID() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed to retry (${res.status})`);

      // A retry is a genuinely new /api/generate call (own idempotency key,
      // own credit deduction) - not resuming the failed row, which stays
      // exactly as it was. The design shows "try again" in place on one
      // card; our data model ties one idempotency key to one row, so a new
      // attempt is a new row, appended to the top of the feed instead.
      setModels((prev) => [
        {
          ...model,
          id: body.modelId,
          status: "pending",
          glb_url: null,
          usdz_url: null,
          render_url: null,
          provider_job_id: null,
          usdz_provider_job_id: null,
          idempotency_key: null,
          size_retry_count: 0,
          bbox_width_m: null,
          bbox_depth_m: null,
          bbox_height_m: null,
          error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Failed to retry");
    }
  }

  const activeJob = models.find((m) => m.status === "pending" || m.status === "processing");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {activeJob && <StatusStrip createdAt={activeJob.created_at} />}

      {retryError && <p className="px-4 py-2 text-small text-danger">{retryError}</p>}

      {models.length === 0 ? (
        <EmptyState
          className="m-4"
          title="No models yet"
          description="Tap create to generate your first 3D model."
        />
      ) : (
        <div className="columns-2 gap-px overflow-y-auto">
          {models.map((model) => (
            <ModelCard key={model.id} initialModel={model} onRetry={handleRetry} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelCard({ initialModel, onRetry }: { initialModel: ModelRow; onRetry: (model: ModelRow) => void }) {
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;

  // design/01, design/06: the card shows the generated object on a dark
  // studio backdrop (lib/renderThumbnail.ts), not the source photo — falls
  // back to the source photo only when there's no render yet (still
  // generating, or the render itself failed — see the webhook's try/catch,
  // never a reason to fail the generation).
  const thumbnailSrc = model.render_url ? buildModelUrl(model.render_url) : `/api/uploads/${model.source_image_key}`;

  const content = (
    <div className="mb-px break-inside-avoid bg-surface">
      <div className="relative w-full bg-surface-hover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailSrc}
          alt=""
          className="block w-full"
        />
        {model.status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
            <p className="text-small uppercase tracking-wide text-text-muted">Couldn&apos;t generate</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="text-body text-text">{model.title || "Untitled"}</p>
        <StatusLine model={model} onRetry={onRetry} />
      </div>
    </div>
  );

  if (model.status !== "ready") return content;

  return (
    <Link href={`/models/${model.id}`} className="block">
      {content}
    </Link>
  );
}

function StatusLine({ model, onRetry }: { model: ModelRow; onRetry: (model: ModelRow) => void }) {
  if (model.status === "ready") {
    const dims = formatDimensionsCm(model);
    return <p className="text-small uppercase tracking-wide text-text-muted">{dims}</p>;
  }

  if (model.status === "failed") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-small uppercase tracking-wide text-text-muted">Credit refunded</p>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onRetry(model);
          }}
          className="w-fit text-small uppercase tracking-wide text-text underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  return <GeneratingLine createdAt={model.created_at} />;
}

function GeneratingLine({ createdAt }: { createdAt: string }) {
  const elapsed = useElapsedTime(createdAt);
  return <p className="text-small uppercase tracking-wide text-text-muted">Generating · {elapsed}</p>;
}
