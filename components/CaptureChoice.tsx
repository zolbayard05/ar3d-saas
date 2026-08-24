"use client";

import { useRef } from "react";
import { Camera, ImageUp } from "lucide-react";
import { ALLOWED_IMAGE_TYPES } from "@/lib/uploads";

export interface CaptureChoiceProps {
  onTakePhoto: () => void;
  onFileChosen: (file: File) => void;
}

// Two compact rounded-card tiles — CaptureFlow.tsx renders these at a fixed
// position at the top of the whole /create screen, permanently (2026-08-24:
// they used to be swapped out for a separate full-screen Confirm/Generating/
// Result step; now those render below this same row instead, so the two
// choices stay visible and tappable throughout). Reference: a Tripo
// screenshot — two compact rounded-card tiles near the top rather than
// stretched to fill the screen, using this app's own rounded-card/
// surface-hover tokens rather than Tripo's own grey fill.
export function CaptureChoice({ onTakePhoto, onFileChosen }: CaptureChoiceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
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
  );
}
