"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { buildLogoQr } from "@/lib/qr";

interface ModelShareProps {
  title: string;
}

// window.location is unavailable during SSR/first hydration and never
// changes after mount for this page, so useSyncExternalStore's no-op
// subscribe is the sanctioned way to read it without a setState-in-effect
// (react-hooks/set-state-in-effect) — same reasoning InstallPrompt.tsx uses
// for its own client-only detection.
function subscribeNever() {
  return () => {};
}
function getUrlSnapshot() {
  return window.location.href;
}
function getServerUrlSnapshot() {
  return "";
}

/** QR code + copy/save/native-share actions for the current page URL. */
export function ModelShare({ title }: ModelShareProps) {
  const url = useSyncExternalStore(subscribeNever, getUrlSnapshot, getServerUrlSnapshot);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    buildLogoQr(url)
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleNativeShare() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: title || "3D model", url });
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }
    await handleCopy();
  }

  // `<a download>` doesn't reliably save to the phone's photo library — iOS
  // Safari in particular ignores the download attribute on a data: URI and
  // just opens the image instead of saving it. Sharing an actual File
  // through the Web Share API is what puts "Save Image"/"Save to Photos" in
  // front of the user (supported iOS 16.4+, Android Chrome); desktop and
  // any browser without file-sharing support fall back to the plain
  // download link, which does work there.
  async function handleSaveQr() {
    if (!qrDataUrl) return;
    let file: File | null = null;
    try {
      const blob = await fetch(qrDataUrl).then((res) => res.blob());
      file = new File([blob], "model-qr.png", { type: "image/png" });
    } catch {
      file = null;
    }
    // Once file-sharing is actually offered, always resolve through it —
    // including a dismissed share sheet — rather than falling through to
    // download and effectively forcing a second, unrequested save.
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "model-qr.png";
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-4">
      {qrDataUrl ? (
        // Baked-in white background (light: "#ffffff" above) so this reads
        // as a self-contained scan card against the dark page — no wrapper
        // div needed.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={`${title || "энэ model"}-ийн QR код`}
          className="size-44 rounded-md shadow-card"
        />
      ) : (
        <div className="size-44 animate-pulse rounded-md bg-surface-hover" />
      )}
      <p className="max-w-full truncate text-small text-text-muted">{url}</p>
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-surface-hover py-2.5 text-small font-semibold text-text hover:opacity-90"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Хуулагдлаа" : "Хуулах"}
        </button>
        <button
          type="button"
          onClick={() => void handleNativeShare()}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-surface-hover py-2.5 text-small font-semibold text-text hover:opacity-90"
        >
          <Share2 className="size-4" />
          Хуваалцах
        </button>
        {qrDataUrl && (
          <button
            type="button"
            onClick={() => void handleSaveQr()}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-surface-hover py-2.5 text-small font-semibold text-text hover:opacity-90"
          >
            <Download className="size-4" />
            Хадгалах
          </button>
        )}
      </div>
    </div>
  );
}
