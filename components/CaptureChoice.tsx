"use client";

import { useRef } from "react";
import { Camera, ImageUp, Zap, CheckCircle2, XCircle } from "lucide-react";
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
export function CaptureChoice({
  userId,
  file,
  onFileChosen,
  onCreate,
  creating,
  busy,
  error,
}: CaptureChoiceProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { credits, loading } = useCredits(userId);

  return (
    <div className="flex flex-col gap-3">
      {/* Rule 20 — "show example good/bad reference images". No real
          before/after photo assets exist for this yet, so a short
          checklist stands in for them (cheap to keep accurate, no image
          pipeline to maintain); swap for real reference photos if/when
          those get shot. Point is stopping avoidable failed generations
          (blurry/multi-object shots) before a credit gets spent, not
          exhaustive photography advice. */}
      <div className="flex flex-col gap-1.5 rounded-sm bg-surface-hover/40 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-small text-text-muted">
          <CheckCircle2 className="size-3.5 shrink-0 text-success" />
          <span>Нэг тод объект, сайн гэрэлтэй, ойрхоноос</span>
        </div>
        <div className="flex items-center gap-1.5 text-small text-text-muted">
          <XCircle className="size-3.5 shrink-0 text-danger" />
          <span>Бүрхэг, харанхуй, олон объект нэг зурган дээр</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        {/* lg:hidden — capture="environment" opens the native OS camera on
            phones, but desktop browsers just ignore that attribute and fall
            back to a plain file picker, making this button a second,
            confusing copy of "Зураг оруулах" right next to it (caught
            2026-08-29, live on the desktop layout). A viewport breakpoint,
            not a getUserMedia/device capability check — matches every other
            mobile-vs-desktop decision in this app (Sidebar/BottomNav,
            hooks/useColumnCount.ts) and doesn't need a camera-permission
            prompt just to decide what a button should say. */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-sm bg-surface-hover text-text hover:opacity-90 lg:hidden"
        >
          <Camera className="size-8" />
          <span className="text-small uppercase tracking-wide">Зураг авах</span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-sm bg-surface-hover text-text hover:opacity-90 lg:aspect-video"
        >
          <ImageUp className="size-8" />
          <span className="text-small uppercase tracking-wide">
            Зураг оруулах
          </span>
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
