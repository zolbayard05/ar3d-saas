"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";

export interface DesktopVideoDialogProps {
  /** YouTube video id (the part after youtu.be/ or ?v=), not a full URL. */
  videoId: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Native <dialog> YouTube player for the hero's "Хэрхэн ажилладагийг үзэх"
 * link — same landing-page-hardcoded-dark-palette convention as
 * DesktopWaitlistCta.tsx's own dialog (Desktop*.tsx is token-exempt, see
 * that file's header comment).
 *
 * The iframe is only mounted while `open` is true, not just whenever the
 * <dialog> itself is open: a closed <dialog> is `display:none` via the UA
 * stylesheet, which doesn't stop an already-playing embedded video's audio
 * on its own — unmounting the iframe on close is what actually stops
 * playback, rather than leaving it silently running behind a hidden panel.
 */
export function DesktopVideoDialog({ videoId, className, style, children }: DesktopVideoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
        className={className}
        style={style}
      >
        {children}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        // Native <dialog> click-outside-to-close: a backdrop click bubbles
        // to the dialog element itself as the event target, while a click
        // on any actual child (the video/close button) does not — no
        // separate overlay element needed.
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        className="backdrop:bg-black/70"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          margin: 0,
          background: "#000",
          border: "1px solid rgb(255 255 255 / 0.12)",
          borderRadius: "16px",
          padding: 0,
          maxWidth: "960px",
          width: "calc(100vw - 48px)",
          overflow: "hidden",
        }}
      >
        <div className="relative" style={{ aspectRatio: "16 / 9" }}>
          {open && (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
              title="Хэрхэн ажилладаг"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 size-full"
              style={{ border: 0 }}
            />
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Хаах"
            className="absolute z-10 flex items-center justify-center rounded-full hover:opacity-80"
            style={{ top: "10px", right: "10px", width: "32px", height: "32px", background: "rgb(0 0 0 / 0.6)", color: "#fff" }}
          >
            <X className="size-4" />
          </button>
        </div>
      </dialog>
    </>
  );
}
