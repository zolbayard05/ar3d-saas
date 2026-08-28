"use client";

import { useRef } from "react";
import { Camera, ImageUp, Zap } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useCredits } from "@/hooks/useCredits";
import { ALLOWED_IMAGE_TYPES } from "@/lib/uploads";

export interface CaptureChoiceProps {
  userId: string;
  file: File | null;
  onFileChosen: (file: File) => void;
  onCreate: () => void;
  creating: boolean;
  /** True while a previous generation is still being reviewed (Generating/Result) — Create stays disabled until that's resolved. */
  busy: boolean;
  error: string | null;
}

const CREDIT_COST = 1;

// Take Photo, Upload Photo, and Create stay fixed on screen the whole time
// (2026-08-24, reverting the "photo replaces the cards" version tried
// earlier this session) — whatever's happening (a chosen-but-not-yet-
// created photo, Generating, the Save/Delete Result) renders below this
// row in CaptureFlow.tsx instead of swapping this row out. Create is
// disabled with no file chosen yet, or while a previous generation is
// still being reviewed (`busy`) — one at a time.
export function CaptureChoice({ userId, file, onFileChosen, onCreate, creating, busy, error }: CaptureChoiceProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { credits, loading } = useCredits(userId);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-sm bg-surface-hover text-text hover:opacity-90"
        >
          <Camera className="size-8" />
          <span className="text-small uppercase tracking-wide">Зураг авах</span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-sm bg-surface-hover text-text hover:opacity-90"
        >
          <ImageUp className="size-8" />
          <span className="text-small uppercase tracking-wide">Зураг оруулах</span>
        </button>
      </div>

      {/* capture="environment" is what actually opens the native OS camera
          (reference: 2026-08-24 iOS screenshots — flash/zoom controls, the
          native shutter, then its own Retake/Use Photo confirmation) rather
          than a custom getUserMedia view; Android's browsers honor it the
          same way. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) onFileChosen(chosen);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) onFileChosen(chosen);
          event.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={onCreate}
        disabled={!file || creating || busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-accent text-small font-semibold uppercase tracking-wide text-accent-text shadow-card hover:bg-accent-hover disabled:opacity-40"
      >
        {creating ? (
          <Spinner size="sm" />
        ) : (
          <>
            Үүсгэх
            <span className="flex items-center gap-1 rounded-full bg-accent-text/10 px-2 py-0.5 text-small normal-case tracking-normal">
              <Zap className="size-3.5" />
              {CREDIT_COST}
            </span>
          </>
        )}
      </button>

      <div className="flex flex-col items-center gap-1">
        {!loading && (
          <p className="text-small uppercase tracking-wide text-text-muted">
            {credits ?? 0} кредит үлдсэн
          </p>
        )}
        {error && <p className="text-small text-danger">{error}</p>}
      </div>
    </div>
  );
}
