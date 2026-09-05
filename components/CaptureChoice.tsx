"use client";

import { useRef, type ReactNode } from "react";
import { ImageUp, Images, Plus, X, Zap, CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useCredits } from "@/hooks/useCredits";
import { ALLOWED_IMAGE_TYPES } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export type CaptureMode = "single" | "multi";

// Matches lib/classifyAngles.ts's MAX_CLASSIFY_IMAGES (duplicated — server-only file).
export const MAX_PHOTOS_TO_ANALYZE = 8;

export interface CaptureChoiceProps {
  userId: string;
  mode: CaptureMode | null;
  onModeChange: (mode: CaptureMode | null) => void;
  /** Multi mode: any order — /api/classify-angles assigns angles. Single mode holds at most one. */
  photos: File[];
  photoPreviewUrls: string[];
  /** Single mode: replaces whatever's there. Multi mode: appends — a multi-select file input can hand this several files in one call. */
  onPhotosAdded: (files: File[]) => void;
  onPhotoRemoved: (index: number) => void;
  onCreate: () => void;
  creating: boolean;
  /** True while a previous generation is still being reviewed (Generating/Result) — Create stays disabled until that's resolved. */
  busy: boolean;
  error: string | null;
}

const CREDIT_COST = 1;

// 2026-09-04 — replaced the old "Зураг авах" (camera)/"Зураг оруулах"
// (gallery) pair entirely with a single/multi PHOTO-COUNT choice instead
// (that old distinction was camera-vs-gallery, an axis mobile browsers
// already collapse into one native picker sheet when a file input has no
// forced `capture` attribute — dropped here for exactly that reason). This
// mode choice is what actually matters for quality: lib/tripo.ts's
// multiview_to_model produces meaningfully better geometry on non-symmetric
// objects from 2-4 angles than image_to_model ever can from one, so it's
// surfaced as the primary decision, not an easy-to-miss "optional extra"
// tucked below the main picker (which is what this used to be).
export function CaptureChoice({
  userId,
  mode,
  onModeChange,
  photos,
  photoPreviewUrls,
  onPhotosAdded,
  onPhotoRemoved,
  onCreate,
  creating,
  busy,
  error,
}: CaptureChoiceProps) {
  const { credits, loading } = useCredits(userId);
  const hasPhoto = photos.length > 0;

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

      {mode === null ? (
        <div className="flex flex-col gap-2">
          <ModeCard
            icon={<ImageUp className="size-6" />}
            title="Ганц зураг оруулах"
            description="Нэг зургаас хурдан 3D загвар үүсгэнэ. Тэгш хэмтэй, энгийн хэлбэртэй бүтээгдэхүүнд тохиромжтой."
            onClick={() => onModeChange("single")}
          />
          <ModeCard
            icon={<Images className="size-6" />}
            title="Олон зураг оруулах"
            description="Өөр өнцгөөс хэдэн ч зураг нэмж болно."
            onClick={() => onModeChange("multi")}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onModeChange(null)}
            disabled={creating}
            className="self-start text-small text-text-muted underline underline-offset-2 hover:text-text disabled:opacity-50"
          >
            ← Горим солих
          </button>

          {mode === "single" ? (
            <PhotoTile
              className="aspect-video w-full"
              file={photos[0] ?? null}
              previewUrl={photoPreviewUrls[0] ?? null}
              disabled={creating}
              onChoose={onPhotosAdded}
              onRemove={() => onPhotoRemoved(0)}
              placeholderIcon={<ImageUp className="size-8" />}
              placeholderLabel="Зураг сонгох"
            />
          ) : (
            <>
              <p className="text-small text-text-muted">
                Дараалал хамаагүй.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <PhotoTile
                    key={`${photo.name}-${photo.lastModified}-${i}`}
                    className="aspect-square"
                    file={photo}
                    previewUrl={photoPreviewUrls[i] ?? null}
                    disabled={creating}
                    onRemove={() => onPhotoRemoved(i)}
                    placeholderIcon={<Plus className="size-6" />}
                    placeholderLabel={`${i + 1}-р зураг`}
                  />
                ))}
                {/* handlePhotosAdded (CaptureFlow.tsx) already caps at
                    MAX_PHOTOS_TO_ANALYZE by dropping overflow — hiding this
                    tile once full is what actually stops the user from
                    trying to add more, rather than silently no-op'ing. */}
                {photos.length < MAX_PHOTOS_TO_ANALYZE && (
                  <PhotoTile
                    className="aspect-square"
                    file={null}
                    previewUrl={null}
                    disabled={creating}
                    multiple
                    onChoose={onPhotosAdded}
                    placeholderIcon={<Plus className="size-6" />}
                    placeholderLabel="Нэмэх"
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onCreate}
        disabled={!hasPhoto || creating || busy}
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

interface ModeCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

/** One of the two top-level "Ганц зураг"/"Олон зураг" choices — icon + title + a real explanation, not just a bare label, so the tradeoff is visible before picking. */
function ModeCard({ icon, title, description, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-sm bg-surface-hover p-4 text-left hover:opacity-90"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface text-text">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-small font-semibold uppercase tracking-wide text-text">{title}</span>
        <span className="text-small text-text-muted">{description}</span>
      </span>
    </button>
  );
}

interface PhotoTileProps {
  file: File | null;
  previewUrl: string | null;
  disabled: boolean;
  placeholderIcon: ReactNode;
  placeholderLabel: string;
  className?: string;
  /** Multi-select on the underlying input — lets one tap add several photos at once instead of one tap per slot. */
  multiple?: boolean;
  /** Only reachable via the placeholder (no `file`) branch. */
  onChoose?: (files: File[]) => void;
  /** Only reachable via the filled (`file` present) branch. */
  onRemove?: () => void;
}

/**
 * One photo tile — a "+"/label placeholder before a file is chosen, or the
 * chosen photo itself filling the exact same tile after (the photo replaces
 * the button in place, not a separate preview box elsewhere on the screen —
 * this is the whole point for single mode, and what makes multi mode read
 * as one coherent photo grid rather than pickers-plus-thumbnails-below).
 * No forced `capture` attribute on the file input — on mobile this still
 * opens the OS's native "Camera / Photo Library" choice sheet either way,
 * which is what let the old separate camera button go away, and (with
 * `multiple`) still lets a user pick several from one gallery visit.
 */
function PhotoTile({
  file,
  previewUrl,
  disabled,
  placeholderIcon,
  placeholderLabel,
  className,
  multiple,
  onChoose,
  onRemove,
}: PhotoTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (file && previewUrl) {
    return (
      <div className={cn("relative overflow-hidden rounded-sm bg-surface", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={placeholderLabel} className="size-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`${placeholderLabel} хасах`}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-bg/80 text-text hover:bg-bg disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-sm bg-surface-hover text-text-muted hover:opacity-90 disabled:opacity-50",
        className,
      )}
    >
      {placeholderIcon}
      <span className="text-small uppercase tracking-wide">{placeholderLabel}</span>
      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const chosen = Array.from(event.target.files || []);
          if (chosen.length > 0) onChoose?.(chosen);
          event.target.value = "";
        }}
      />
    </button>
  );
}
