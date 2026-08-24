"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActiveGenerationBanner } from "@/components/ActiveGenerationBanner";
import { CaptureChoice } from "@/components/CaptureChoice";
import { CaptureStep } from "@/components/CaptureStep";
import { GeneratingStep } from "@/components/GeneratingStep";
import { ResultStep } from "@/components/ResultStep";
import { useUpload } from "@/hooks/useUpload";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface CaptureFlowProps {
  userId: string;
  /** A model the caller already had generating before landing on this page — see create/page.tsx. */
  initialActiveModel?: ModelRow;
}

type Mode = "choice" | "camera";

interface GeneratingModel {
  id: string;
  createdAt: string;
}

// CaptureChoice.tsx owns the Photo/Camera picker, the chosen-photo preview,
// and the persistent Create button as one unit (2026-08-24 — Tripo's own
// reference: Create exists from the start, and picking a photo replaces the
// tiles with the photo in the same slot rather than both staying visible).
// Generating and the Save/Delete result each take over that whole area
// instead — Create's job is done by then, there's nothing left to pick.
// Only the live camera is still a separate full-screen step (its own
// immersive view; a two-card picker and a viewfinder don't fit together).
// Nothing is uploaded until Create is actually pressed; capturing/choosing
// a photo alone spends no credit and touches no server. A finished model
// only reaches My Models (library/page.tsx's status filter is no
// protection here; the row is already `ready` the moment generation
// succeeds) once ResultStep's own Save is pressed — Delete there removes it
// via the same lib/deleteModel.ts every other delete action uses, same as
// never having kept it.
export function CaptureFlow({ userId, initialActiveModel }: CaptureFlowProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choice");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingModel, setGeneratingModel] = useState<GeneratingModel | null>(null);
  const [resultModel, setResultModel] = useState<ModelRow | null>(null);
  const { upload } = useUpload();

  // Owned here, not inside CaptureChoice — GeneratingStep needs the same
  // preview after CaptureChoice's photo slot has moved on, so the blob URL
  // has to outlive that one state rather than being revoked with it.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleCreate() {
    if (!file) return;
    setCreating(true);
    setError(null);
    try {
      // MasonryGrid needs the photo's real pixel aspect ratio to balance
      // columns by expected card height up front (see that file) — reading
      // it here, once, at the one point a File object exists for either
      // capture path (camera canvas blob or gallery pick), rather than
      // duplicating it in CaptureStep for each. Best-effort: a decode
      // failure shouldn't block generation, just means this model falls
      // back to MasonryGrid's neutral default ratio.
      let sourceImageWidth: number | undefined;
      let sourceImageHeight: number | undefined;
      try {
        const bitmap = await createImageBitmap(file);
        sourceImageWidth = bitmap.width;
        sourceImageHeight = bitmap.height;
        bitmap.close();
      } catch {
        // fall through with both undefined
      }

      const uploaded = await upload(file);
      if (!uploaded) throw new Error("Upload failed");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageKey: uploaded.key,
          idempotencyKey: crypto.randomUUID(),
          sourceImageWidth,
          sourceImageHeight,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed to start generation (${res.status})`);

      setGeneratingModel({ id: body.modelId, createdAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setCreating(false);
    }
  }

  function resetToChoice() {
    setFile(null);
    setGeneratingModel(null);
    setResultModel(null);
    setMode("choice");
  }

  if (mode === "camera") {
    return <CaptureStep onCaptured={setFile} onBack={() => setMode("choice")} />;
  }

  const wrapperClassName = "flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4";
  const wrapperStyle = { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" };

  if (resultModel) {
    return (
      <div className={wrapperClassName} style={wrapperStyle}>
        <ResultStep
          model={resultModel}
          onSaved={() => router.push(`/models/${resultModel.id}`)}
          onDeleted={resetToChoice}
        />
      </div>
    );
  }

  if (generatingModel && previewUrl) {
    return (
      <div className={wrapperClassName} style={wrapperStyle}>
        <GeneratingStep
          modelId={generatingModel.id}
          previewUrl={previewUrl}
          createdAt={generatingModel.createdAt}
          onReady={setResultModel}
          onFailed={() => router.push(`/models/${generatingModel.id}`)}
        />
      </div>
    );
  }

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      <CaptureChoice
        userId={userId}
        onTakePhoto={() => setMode("camera")}
        file={file}
        previewUrl={previewUrl}
        onFileChosen={setFile}
        onRetake={() => setFile(null)}
        onCreate={handleCreate}
        creating={creating}
        error={error}
      />
      {!file && initialActiveModel && <ActiveGenerationBanner initialModel={initialActiveModel} />}
    </div>
  );
}
