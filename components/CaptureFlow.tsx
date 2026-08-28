"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { CaptureChoice } from "@/components/CaptureChoice";
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

interface GeneratingModel {
  id: string;
  createdAt: string;
}

// Take Photo, Upload Photo, and Create (CaptureChoice.tsx) stay fixed at
// the top of /create for the whole flow (2026-08-24 — explicit correction:
// an earlier version replaced them with the chosen photo, Tripo-reference-
// style; this one keeps them up and runs everything else below instead).
// Below that fixed row: the chosen-but-not-yet-created photo (with a small
// Retake), then Generating, then the Save/Delete Result — never swapping
// the picker/Create row out, only ever adding content beneath it.
// "Take Photo" is a plain file input with capture="environment", not a
// custom live-camera view — the native OS camera UI (2026-08-24 reference
// screenshots) is what's wanted, and that attribute already gets it on
// both iOS and Android. Nothing is uploaded until Create is actually
// pressed; capturing/choosing a photo alone spends no credit and touches
// no server. A finished model only reaches My Models (library/page.tsx's
// status filter is no protection here; the row is already `ready` the
// moment generation succeeds) once ResultStep's own Save is pressed —
// Delete there removes it via the same lib/deleteModel.ts every other
// delete action uses, same as never having kept it.
//
// initialActiveModel (a generation already running when the caller landed
// on /create) seeds generatingModel directly, sourced from the model's own
// stored photo (via /api/uploads) instead of a local blob URL — there's no
// File object left for a generation started in an earlier page load — so
// arriving mid-generation renders the exact same GeneratingStep a fresh
// Create press would, not a separate smaller "still going" indicator.
export function CaptureFlow({ userId, initialActiveModel }: CaptureFlowProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingModel, setGeneratingModel] =
    useState<GeneratingModel | null>(() =>
      initialActiveModel
        ? {
            id: initialActiveModel.id,
            createdAt: initialActiveModel.created_at,
          }
        : null,
    );
  const [generatingPreviewUrl, setGeneratingPreviewUrl] = useState<
    string | null
  >(() =>
    initialActiveModel
      ? `/api/uploads/${initialActiveModel.source_image_key}`
      : null,
  );
  const [resultModel, setResultModel] = useState<ModelRow | null>(null);
  const { upload } = useUpload();

  // GeneratingStep needs the same preview after the chosen-photo block
  // below has moved on, so the blob URL has to outlive that render rather
  // than being revoked with it.
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
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
      // it here, once, at the one point a File object exists, whichever
      // input it came from (CaptureChoice.tsx's camera or gallery file
      // input). Best-effort: a decode failure shouldn't block generation,
      // just means this model falls back to MasonryGrid's neutral default
      // ratio.
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
      if (!uploaded) throw new Error("Оруулахад алдаа гарлаа");

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
      if (!res.ok)
        throw new Error(
          body.error ?? `Үүсгэлт эхлүүлэхэд алдаа гарлаа (${res.status})`,
        );

      // file stays set (not cleared here) — clearing it now would flip the
      // previewUrl memo to null on the next render, and the cleanup effect
      // tied to that memo would revoke this exact blob URL out from under
      // GeneratingStep, which just received the same string. Cleared in
      // resetAfterResult instead, once nothing downstream needs it.
      setGeneratingModel({
        id: body.modelId,
        createdAt: new Date().toISOString(),
      });
      setGeneratingPreviewUrl(previewUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Үүсгэлт эхлүүлэхэд алдаа гарлаа",
      );
      setCreating(false);
    }
  }

  function resetAfterResult() {
    setFile(null);
    setGeneratingModel(null);
    setGeneratingPreviewUrl(null);
    setResultModel(null);
  }

  const busy = !!generatingModel || !!resultModel;

  return (
    // lg:max-w-xl (Tailwind's own scale, 36rem/576px — not an invented
    // value) centers this as a single focused column at lg+ rather than
    // stretching the picker cards/preview/result to the full width beside
    // Sidebar — unlike Home/Library this screen is one task, not a browse
    // grid, so it doesn't want the extra width at all. lg:flex-none +
    // lg:my-auto (overriding the mobile flex-1 fill) vertically centers
    // this short column in the available height too, instead of it sitting
    // pinned to the top with a wall of empty page below (feedback: "хэт
    // хоосон/уйтгартай") — flex-1's grow and an auto margin on the same
    // axis fight each other if both are present, so flex-1 has to be
    // cancelled here, not just added to.
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4 lg:mx-auto lg:my-auto lg:w-full lg:max-w-xl lg:flex-none lg:px-0"
      // --bottom-nav-reserve (styles/tokens.css) — same token
      // HomeFeed/LibraryFeed use: 6rem (~92-96px, close enough to this
      // screen's previously-hardcoded 92px to consolidate into one shared
      // value) on mobile to clear BottomNav, 2.5rem at lg+ where Sidebar
      // replaces it and there's nothing bottom-docked left to clear.
      style={{
        paddingBottom:
          "calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-reserve))",
      }}
    >
      <CaptureChoice
        userId={userId}
        file={file}
        onFileChosen={setFile}
        onCreate={handleCreate}
        creating={creating}
        busy={busy}
        error={error}
      />

      {file && previewUrl && !busy && (
        <div className="relative w-full overflow-hidden rounded-sm bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Сонгосон зураг"
            className="mx-auto block max-h-72 w-auto max-w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setFile(null)}
            disabled={creating}
            aria-label="Дахин авах"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-bg/80 text-text hover:bg-bg disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {resultModel ? (
        <ResultStep
          model={resultModel}
          onSaved={() => router.push(`/models/${resultModel.id}`)}
          onDeleted={resetAfterResult}
        />
      ) : (
        generatingModel &&
        generatingPreviewUrl && (
          <GeneratingStep
            modelId={generatingModel.id}
            previewUrl={generatingPreviewUrl}
            createdAt={generatingModel.createdAt}
            onReady={setResultModel}
            onFailed={() => router.push(`/models/${generatingModel.id}`)}
          />
        )
      )}
    </div>
  );
}
