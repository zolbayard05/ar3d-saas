"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, X, Zap } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useCredits } from "@/hooks/useCredits";
import { ALLOWED_IMAGE_TYPES } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export interface CaptureChoiceProps {
  userId: string;
  onTakePhoto: () => void;
  file: File | null;
  previewUrl: string | null;
  onFileChosen: (file: File) => void;
  onRetake: () => void;
  onCreate: () => void;
  creating: boolean;
  error: string | null;
}

const CREDIT_COST = 1;

// Reference: two Tripo screenshots (2026-08-24) — Create exists as a
// persistent button from the very start (a "1 model = 1 credit" cue, not
// something that only appears once a photo is picked), and choosing a
// photo replaces the Photo/Camera tiles with the photo itself in the same
// spot rather than both staying on screen. Both behaviors reproduced here
// with this app's own tokens: the picker cards and the photo preview share
// one slot (animated on swap — see useSlotEnter below), and Create sits
// fixed underneath either state, disabled with no file yet.
function useSlotEnter(key: string) {
  const [entered, setEntered] = useState(false);
  // Reset synchronously during render when the key changes — the React-
  // documented pattern for "adjust state when a prop changes" — rather
  // than in the effect body, which react-hooks/set-state-in-effect flags.
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setEntered(false);
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [key]);

  return entered;
}

export function CaptureChoice({
  userId,
  onTakePhoto,
  file,
  previewUrl,
  onFileChosen,
  onRetake,
  onCreate,
  creating,
  error,
}: CaptureChoiceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { credits, loading } = useCredits(userId);
  const entered = useSlotEnter(file ? "photo" : "cards");

  return (
    <div className="flex flex-col gap-3">
      {/* Not flex-1 — sized to its own content (cards' aspect-square, or the
          photo's fixed aspect-[2/1] approximating the two-card row's own
          footprint) so Create sits immediately below it, the way the
          reference has it, instead of stretching to fill the screen and
          pushing Create down to the very bottom. */}
      <div
        className={cn(
          "transition-all duration-300 ease-out",
          entered ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
      >
        {previewUrl ? (
          <div className="relative aspect-[2/1] w-full overflow-hidden rounded-card bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Captured photo" className="size-full object-cover" />
            <button
              type="button"
              onClick={onRetake}
              disabled={creating}
              aria-label="Retake"
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-bg/80 text-text hover:bg-bg disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
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
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
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
        disabled={!file || creating}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-body font-semibold uppercase tracking-wide text-accent-text shadow-card hover:bg-accent-hover disabled:opacity-40"
      >
        {creating ? (
          <Spinner size="sm" />
        ) : (
          <>
            Create
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
            {credits ?? 0} credits remaining
          </p>
        )}
        {error && <p className="text-small text-danger">{error}</p>}
      </div>
    </div>
  );
}
