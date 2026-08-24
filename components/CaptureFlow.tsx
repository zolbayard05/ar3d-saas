"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaptureStep } from "@/components/CaptureStep";
import { ConfirmStep } from "@/components/ConfirmStep";
import { useUpload } from "@/hooks/useUpload";

export interface CaptureFlowProps {
  userId: string;
}

// Capture and Confirm are two steps of one client-side flow, not two
// routes: the captured Blob only exists in memory (URL.createObjectURL),
// and there's no reason to persist it anywhere or make either step
// bookmarkable on its own — the whole point is a short, linear "shoot,
// check, go" sequence. Nothing is uploaded until Create is actually
// pressed on Confirm; capturing/choosing a photo alone spends no credit
// and touches no server.
export function CaptureFlow({ userId }: CaptureFlowProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upload } = useUpload();

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

      // Straight to My Models, not a dedicated waiting screen — the new
      // pending row already shows there as a normal ModelCard (dimmed
      // photo, pulsing app-mark, progress line; see ModelCard.tsx), so
      // generation status only ever appears inline in the grid, never as
      // its own full-screen takeover.
      router.push("/library");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setCreating(false);
    }
  }

  if (!file) {
    return <CaptureStep onCaptured={setFile} />;
  }

  return (
    <ConfirmStep
      file={file}
      userId={userId}
      onRetake={() => setFile(null)}
      onCreate={handleCreate}
      creating={creating}
      error={error}
    />
  );
}
