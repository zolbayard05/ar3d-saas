"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaptureChoice, MAX_MULTIVIEW_PHOTOS, type CaptureMode } from "@/components/CaptureChoice";
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

// CaptureChoice (mode picker + photo tiles + Create) stays fixed at the top
// of /create for the whole flow (2026-08-24 — explicit correction: an
// earlier version replaced it with the chosen photo, Tripo-reference-style;
// this one keeps it up and runs everything else below instead). Generating,
// then the Save/Delete Result render below it — never swapping the
// picker/Create row out, only ever adding content beneath it.
//
// 2026-09-04: CaptureChoice's own picker used to be two fixed buttons
// (camera capture vs. gallery), with a chosen photo previewed in a separate
// box further down this page, plus an easy-to-miss "optional extra angles"
// row below that. Replaced with an explicit single-vs-multi-photo mode
// choice up front (each photo now shown filling its own picker tile in
// place, not a separate preview elsewhere) — see CaptureChoice.tsx's own
// header comment for why.
//
// Nothing is uploaded until Create is actually pressed; choosing photos
// alone spends no credit and touches no server. A finished model only
// reaches My Models (library/page.tsx's status filter is no protection
// here; the row is already `ready` the moment generation succeeds) once
// ResultStep's own Save is pressed — Delete there removes it via the same
// lib/deleteModel.ts every other delete action uses, same as never having
// kept it.
//
// initialActiveModel (a generation already running when the caller landed
// on /create) seeds generatingModel directly, sourced from the model's own
// stored photo (via /api/uploads) instead of a local blob URL — there's no
// File object left for a generation started in an earlier page load — so
// arriving mid-generation renders the exact same GeneratingStep a fresh
// Create press would, not a separate smaller "still going" indicator.
export function CaptureFlow({ userId, initialActiveModel }: CaptureFlowProps) {
  const router = useRouter();
  const [mode, setMode] = useState<CaptureMode | null>(null);
  // photos[0] is the required front photo; 1-3 (only in "multi" mode) are
  // optional angles for lib/tripo.ts's multiview_to_model (see
  // MAX_MULTIVIEW_PHOTOS — anything past index 3 is picked but never
  // uploaded/sent, see handleCreate below). Dynamic length, not a fixed
  // 4-slot array (2026-09-04: that read as bad UX, forcing one tap per
  // slot) — CaptureChoice's own multi-select "Нэмэх" tile can append
  // several files here in one call.
  const [photos, setPhotos] = useState<File[]>([]);
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
  const { upload, error: uploadError } = useUpload();

  // GeneratingStep needs photos[0]'s preview after CaptureChoice has moved on
  // to showing Generating instead of the picker, so the blob URL has to
  // outlive that render rather than being revoked with it.
  const photoPreviewUrls = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => {
    return () => {
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviewUrls]);
  const previewUrl = photoPreviewUrls[0];

  function handlePhotosAdded(files: File[]) {
    if (files.length === 0) return;
    // Single mode always holds at most one — a new choice replaces it
    // (PhotoTile's onChoose there is the "change photo" affordance, not
    // "add another"). Multi mode appends, letting one multi-select action
    // (CaptureChoice's "Нэмэх" tile) add several at once — capped at
    // MAX_MULTIVIEW_PHOTOS (lib/tripo.ts's multiview_to_model has exactly
    // that many slots, [front,left,back,right], no 5th to put anything in)
    // rather than accepting more and quietly not using the rest; excess
    // from a multi-select that would overflow is simply dropped.
    if (mode === "single") {
      setPhotos([files[0]]);
      return;
    }
    setPhotos((prev) => {
      const room = MAX_MULTIVIEW_PHOTOS - prev.length;
      return room <= 0 ? prev : [...prev, ...files.slice(0, room)];
    });
  }
  function handlePhotoRemoved(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }
  function handleModeChange(next: CaptureMode | null) {
    setMode(next);
    // Switching to single mode discards anything past the first photo —
    // multi mode's extra angles have no meaning there, and leaving them
    // would silently resurrect them if the user switches back.
    if (next === "single") {
      setPhotos((prev) => prev.slice(0, 1));
    }
  }

  async function handleCreate() {
    const file = photos[0];
    if (!file) return;
    setCreating(true);
    setError(null);
    try {
      // Stored on the row (migration 0012) at the one point a File object
      // exists — not currently read by MasonryGrid/ModelCard.tsx
      // (2026-09-03: every card renders at a fixed MODEL_CARD_ASPECT_RATIO
      // now, object-contain, regardless of the source photo's own shape),
      // but kept as it's cheap, harmless metadata a future feature could
      // still use. Best-effort: a decode failure just leaves both columns
      // null, same as any pre-migration-0012 row.
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
      // Surface useUpload's own specific reason (auth failure, R2/CORS
      // error, bad presign response, ...) instead of masking it behind a
      // generic message — that generic string used to show unconditionally
      // here regardless of what actually failed, making every upload
      // failure look identical and undiagnosable from the UI alone.
      if (!uploaded) throw new Error(uploadError || "Оруулахад алдаа гарлаа");

      // Sequential, reusing the same useUpload instance as the front photo
      // above — these are optional (rule: never block Create over one), so a
      // failed angle upload is just dropped (logged), not surfaced as an
      // error the way the required front upload's failure is. photos[0] was
      // already uploaded above; only the next MAX_MULTIVIEW_PHOTOS-1 go here
      // (left/back/right). handlePhotosAdded already caps `photos` at
      // MAX_MULTIVIEW_PHOTOS, so this slice's upper bound is defensive, not
      // load-bearing.
      const angleKeys: (string | undefined)[] = [];
      for (const angleFile of photos.slice(1, MAX_MULTIVIEW_PHOTOS)) {
        const angleUploaded = await upload(angleFile);
        if (!angleUploaded) {
          console.warn("CaptureFlow: optional angle photo failed to upload, continuing without it");
        }
        angleKeys.push(angleUploaded?.key);
      }
      while (angleKeys.length < MAX_MULTIVIEW_PHOTOS - 1) angleKeys.push(undefined);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageKey: uploaded.key,
          idempotencyKey: crypto.randomUUID(),
          sourceImageWidth,
          sourceImageHeight,
          sourceImageKeyLeft: angleKeys[0],
          sourceImageKeyBack: angleKeys[1],
          sourceImageKeyRight: angleKeys[2],
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
    setMode(null);
    setPhotos([]);
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
        mode={mode}
        onModeChange={handleModeChange}
        photos={photos}
        photoPreviewUrls={photoPreviewUrls}
        onPhotosAdded={handlePhotosAdded}
        onPhotoRemoved={handlePhotoRemoved}
        onCreate={handleCreate}
        creating={creating}
        busy={busy}
        error={error}
      />

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
