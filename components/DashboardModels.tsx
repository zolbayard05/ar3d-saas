"use client";

import Link from "next/link";
import { useState } from "react";
import { Box } from "lucide-react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import type { UploadResult } from "@/hooks/useUpload";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

// Minimal end-to-end wiring only (upload -> generate -> live status -> link
// to the existing detail page) — not a design pass, the real dashboard UI
// lands with the ported design.
export function DashboardModels({ initialModels }: { initialModels: ModelRow[] }) {
  const [models, setModels] = useState(initialModels);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleUploaded(result: UploadResult) {
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageKey: result.key,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Failed to start generation (${res.status})`);
      }
      setModels((prev) => [
        {
          id: body.modelId,
          user_id: "",
          title: null,
          status: "pending",
          source_image_key: result.key,
          glb_url: null,
          usdz_url: null,
          provider: "tripo",
          provider_job_id: null,
          usdz_provider_job_id: null,
          idempotency_key: null,
          size_retry_count: 0,
          scale: 1,
          error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to start generation");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <UploadDropzone onUploaded={handleUploaded} />
      {generateError && <p className="text-small text-danger">{generateError}</p>}

      {models.length === 0 ? (
        <EmptyState
          icon={<Box className="size-10" />}
          title="No models yet"
          description="Upload a photo above to generate your first 3D model."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {models.map((model) => (
            <ModelListItem key={model.id} initialModel={model} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelListItem({ initialModel }: { initialModel: ModelRow }) {
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;
  const content = (
    <div className="flex items-center justify-between gap-4 rounded-card border border-border p-4">
      <span className="text-body text-text">{model.title || "Untitled model"}</span>
      <StatusBadge status={model.status} />
    </div>
  );

  if (model.status !== "ready") return content;

  return (
    <Link href={`/models/${model.id}`} className="hover:opacity-80">
      {content}
    </Link>
  );
}

function StatusBadge({ status }: { status: ModelRow["status"] }) {
  if (status === "ready") return <Badge variant="success">Ready</Badge>;
  if (status === "failed") return <Badge variant="danger">Failed</Badge>;
  return (
    <Badge variant="neutral" className="inline-flex items-center gap-1.5">
      <Spinner size="sm" />
      {status === "processing" ? "Processing" : "Pending"}
    </Badge>
  );
}
