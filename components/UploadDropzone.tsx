"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { CheckCircle2, ImageUp, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpload, type UploadResult } from "@/hooks/useUpload";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

export interface UploadDropzoneProps {
  onUploaded?: (result: UploadResult) => void;
  className?: string;
}

const ACCEPT = Object.keys(ALLOWED_IMAGE_TYPES).join(",");
const MAX_MB = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024));

const BUSY_STATUSES = new Set(["validating", "requesting-url", "uploading"]);

export function UploadDropzone({ onUploaded, className }: UploadDropzoneProps) {
  const { status, progress, error, upload, reset } = useUpload();
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = BUSY_STATUSES.has(status);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || busy) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      void upload(file).then((result) => {
        if (result) onUploaded?.(result);
      });
    },
    [busy, previewUrl, upload, onUploaded],
  );

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    reset();
  }, [previewUrl, reset]);

  const openPicker = useCallback(() => {
    if (!busy) inputRef.current?.click();
  }, [busy]);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      handleFile(event.dataTransfer.files?.[0]);
    },
    [handleFile],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    },
    [openPicker],
  );

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-64 flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-12 text-center transition-colors",
          dragActive ? "border-accent bg-accent/5" : "border-border",
          busy ? "cursor-default opacity-70" : "cursor-pointer hover:border-accent hover:bg-surface-hover",
          status === "error" && "border-danger",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {status === "idle" && (
          <>
            <ImageUp className="size-10 text-text-muted" />
            <p className="text-body font-medium text-text">
              Drop a photo here, or click to browse
            </p>
            <p className="text-small text-text-muted">
              JPEG, PNG, or WEBP — up to {MAX_MB} MB
            </p>
          </>
        )}

        {busy && (
          <>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Selected photo preview"
                className="max-h-32 rounded-md object-contain"
              />
            )}
            <Spinner size="md" />
            <p className="text-small text-text-muted">
              {status === "validating" && "Checking file…"}
              {status === "requesting-url" && "Preparing upload…"}
              {status === "uploading" && `Uploading… ${progress}%`}
            </p>
            {status === "uploading" && (
              <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </>
        )}

        {status === "done" && (
          <>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Uploaded photo preview"
                className="max-h-32 rounded-md object-contain"
              />
            )}
            <CheckCircle2 className="size-8 text-success" />
            <p className="text-body font-medium text-text">Uploaded</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                handleReset();
              }}
            >
              <RotateCcw className="size-4" />
              Upload a different photo
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="size-8 text-danger" />
            <p className="text-small text-danger">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                handleReset();
              }}
            >
              Try again
            </Button>
          </>
        )}
      </div>

      <ExampleGuidance />
    </div>
  );
}

// CLAUDE.md rule 20 — show example good/bad reference images. These are
// illustrative placeholders (icon + one-line description), not real
// photos — swap in actual before/after reference shots when available.
function ExampleGuidance() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex items-start gap-3 rounded-card border border-border-subtle bg-surface p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="flex flex-col gap-1">
          <p className="text-small font-medium text-text">Good</p>
          <p className="text-small text-text-muted">
            Single clear subject, even lighting, plain background.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-card border border-border-subtle bg-surface p-4">
        <XCircle className="mt-0.5 size-5 shrink-0 text-danger" />
        <div className="flex flex-col gap-1">
          <p className="text-small font-medium text-text">Avoid</p>
          <p className="text-small text-text-muted">
            Blurry photos, heavy shadows, or multiple objects in frame — these
            produce unusable meshes and still cost a credit.
          </p>
        </div>
      </div>
    </div>
  );
}
