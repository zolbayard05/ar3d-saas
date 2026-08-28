"use client";

import { useCallback, useState } from "react";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, isAllowedImageType } from "@/lib/uploads";

export type UploadStatus =
  | "idle"
  | "validating"
  | "requesting-url"
  | "uploading"
  | "done"
  | "error";

export interface UploadResult {
  key: string;
  contentType: string;
}

/**
 * Data logic for direct-to-R2 photo uploads (CLAUDE.md: "data logic in
 * hooks, presentation in components"). Client-side validation here is a UX
 * nicety only — app/api/upload-url re-validates independently and is the
 * actual boundary (CLAUDE.md rule 30).
 */
export function useUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  const upload = useCallback(async (file: File): Promise<UploadResult | undefined> => {
    setError(null);
    setResult(null);
    setProgress(0);
    setStatus("validating");

    if (!isAllowedImageType(file.type)) {
      const message = `Дэмжигдэхгүй файлын төрөл. Ашиглах: ${Object.keys(ALLOWED_IMAGE_TYPES).join(", ")}`;
      setStatus("error");
      setError(message);
      return undefined;
    }
    if (file.size === 0) {
      setStatus("error");
      setError("Файл хоосон байна");
      return undefined;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus("error");
      setError(`Файл хэт том байна — дээд тал нь ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`);
      return undefined;
    }

    setStatus("requesting-url");
    let uploadUrl: string;
    let key: string;
    try {
      const res = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, contentLength: file.size }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Байршуулах линк авахад алдаа гарлаа (${res.status})`);
      }
      uploadUrl = body.uploadUrl;
      key = body.key;
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Байршуулах линк авахад алдаа гарлаа");
      return undefined;
    }

    setStatus("uploading");
    try {
      await putWithProgress(uploadUrl, file, setProgress);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Байршуулахад алдаа гарлаа");
      return undefined;
    }

    const finalResult: UploadResult = { key, contentType: file.type };
    setProgress(100);
    setResult(finalResult);
    setStatus("done");
    return finalResult;
  }, []);

  return { status, progress, error, result, upload, reset };
}

// XMLHttpRequest, not fetch — fetch has no cross-browser upload progress
// event, and a multi-MB photo upload without progress reads as hung.
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Байршуулахад алдаа гарлаа (${xhr.status})`));
      }
    };

    // Fires when the browser blocks the request before any HTTP response is
    // delivered to JS — a failed CORS preflight (the common case: the R2
    // bucket's CORS policy doesn't allow this origin/method/header) looks
    // identical to a DNS failure or dropped connection here; the browser
    // deliberately withholds the real reason from script for security. This
    // is NOT the same failure mode as xhr.onload with a 4xx/5xx status
    // (below) — that means a response *did* come back (bad/expired
    // signature, wrong bucket policy, etc), which is a different fix.
    xhr.onerror = () =>
      reject(
        new Error(
          "Network error during upload — the browser blocked the request before getting a response. " +
            "This almost always means the R2 bucket's CORS policy doesn't allow this origin/method (check " +
            "the Network tab for a failed OPTIONS preflight to *.r2.cloudflarestorage.com), not a rejected file.",
        ),
      );
    xhr.onabort = () => reject(new Error("Байршуулалт цуцлагдлаа"));

    xhr.send(file);
  });
}
