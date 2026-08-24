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
// all). Left/right halves, matching the "one side / the other side"
// split asked for, rather than a stacked pair — each is a single large tap
// target, not a small button, so there's exactly one obvious next action.
export function CaptureChoice({ onTakePhoto, onFileChosen, activeGeneration }: CaptureChoiceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <button
          type="button"
          onClick={onTakePhoto}
          className="flex flex-1 flex-col items-center justify-center gap-3 border-r border-border-subtle text-text hover:bg-surface-hover"
        >
          <Camera className="size-8" />
          <span className="text-small uppercase tracking-wide">Take Photo</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-1 flex-col items-center justify-center gap-3 text-text hover:bg-surface-hover"
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

      {/* Only reserves space for BottomNav clearance when there's actually
          something to show here — the plain two-halves layout above has no
          bottom-docked element of its own competing with the nav. */}
      {activeGeneration && (
        <div className="px-4 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}>
          <ActiveGenerationBanner initialModel={activeGeneration} />
        </div>
      )}
    </div>
  );
}
