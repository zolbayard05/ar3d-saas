"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { ALLOWED_IMAGE_TYPES } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export interface CaptureStepProps {
  onCaptured: (file: File) => void;
}

// getUserMedia needs a secure context (https, or localhost in dev) — true
// for both this project's Vercel deployment and `next dev` locally, so no
// separate insecure-context fallback path is needed beyond permission/
// no-camera handling below.
export function CaptureStep({ onCaptured }: CaptureStepProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setCameraError("Couldn't access the camera — choose a photo instead.");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCaptured(new File([blob], "capture.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  function handleFileChosen(file: File | undefined) {
    if (file) onCaptured(file);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-bg">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      {cameraError && (
        <p className="absolute top-1/2 z-10 max-w-xs -translate-y-1/2 px-6 text-center text-small text-text-muted">
          {cameraError}
        </p>
      )}

      {/* Thin white bracket frame — four corner marks, not a filled box, so
          the live camera image underneath stays fully visible. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
        <div className="relative aspect-square w-56">
          {[
            "top-0 left-0 border-t border-l",
            "top-0 right-0 border-t border-r",
            "bottom-0 left-0 border-b border-l",
            "bottom-0 right-0 border-b border-r",
          ].map((corner) => (
            <div key={corner} className={cn("absolute size-6 border-text", corner)} />
          ))}
        </div>
        <p className="text-small uppercase tracking-wide text-text-muted">Center the object in frame</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 pb-8">
        {/* Three tiny reference thumbnails — illustrative placeholders, not
            real photos (same caveat components/UploadDropzone.tsx's
            ExampleGuidance already carries: swap in real before/after shots
            when available). Check/x shape carries the meaning, not color —
            greyscale only, no accent colour anywhere except the AR button
            on the detail screen. */}
        <div className="flex items-center gap-3">
          <ExampleThumb good />
          <ExampleThumb />
          <ExampleThumb />
        </div>

        <button
          type="button"
          onClick={capture}
          aria-label="Capture photo"
          className="size-20 rounded-full bg-accent"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-small uppercase tracking-wide text-text-muted underline underline-offset-2 hover:text-text"
        >
          Choose from gallery
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
        className="hidden"
        onChange={(event) => {
          handleFileChosen(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function ExampleThumb({ good = false }: { good?: boolean }) {
  return (
    <div className="relative flex size-10 items-center justify-center bg-surface">
      <div className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-bg">
        {good ? <Check className="size-3 text-text" /> : <X className="size-3 text-text-muted" />}
      </div>
    </div>
  );
}
