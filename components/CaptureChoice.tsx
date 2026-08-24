"use client";

import { useRef } from "react";
import { Camera, ImageUp } from "lucide-react";
import { ActiveGenerationBanner } from "@/components/ActiveGenerationBanner";
import { ALLOWED_IMAGE_TYPES } from "@/lib/uploads";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface CaptureChoiceProps {
  onTakePhoto: () => void;
  onFileChosen: (file: File) => void;
  activeGeneration?: ModelRow;
}

// First thing /create shows now — camera no longer launches automatically
// on entry (getUserMedia used to fire the moment CaptureStep mounted,
// asking for camera permission before the user had chosen to use it at
// all). Reference: a Tripo screenshot (2026-08-24, second one — the first
// attempt here was two full-height stark halves, which read as empty/
// unfinished) — two compact rounded-card tiles near the top, using this
// app's own rounded-card/surface-hover tokens rather than Tripo's own
// grey fill, leaving real room below for whatever else the screen needs
// (the active-generation banner) instead of the choice eating the whole
// viewport.
export function CaptureChoice({ onTakePhoto, onFileChosen, activeGeneration }: CaptureChoiceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
    >
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onTakePhoto}
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-card bg-surface-hover text-text hover:opacity-90"
        >
          <Camera className="size-8" />
          <span className="text-small uppercase tracking-wide">Take Photo</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-card bg-surface-hover text-text hover:opacity-90"
        >
          <ImageUp className="size-8" />
          <span className="text-small uppercase tracking-wide">Upload Photo</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileChosen(file);
            event.target.value = "";
          }}
        />
      </div>

      {activeGeneration && <ActiveGenerationBanner initialModel={activeGeneration} />}
    </div>
  );
}
