"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Share2 } from "lucide-react";

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
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#0a0a0a", light: "#ffffff" } })
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

  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-4">
      {qrDataUrl ? (
        // Baked-in white background (light: "#ffffff" above) so this reads
        // as a self-contained scan card against the dark page — no wrapper
        // div needed.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt={`QR code for ${title || "this model"}`}
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
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => void handleNativeShare()}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-surface-hover py-2.5 text-small font-semibold text-text hover:opacity-90"
        >
          <Share2 className="size-4" />
          Share
        </button>
        {qrDataUrl && (
          <a
            href={qrDataUrl}
            download="model-qr.png"
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-surface-hover py-2.5 text-small font-semibold text-text hover:opacity-90"
          >
            <Download className="size-4" />
            Save
          </a>
        )}
      </div>
    </div>
  );
}
