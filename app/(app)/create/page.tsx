"use client";

import { useRouter } from "next/navigation";
import { UploadDropzone } from "@/components/UploadDropzone";
import type { UploadResult } from "@/hooks/useUpload";
import { useState } from "react";

// Functional placeholder, not a ported screen: capture/confirm are their
// own turns later (rule 40 — the feed/detail/library/waiting screens are
// the reference now, design/*.png is retired). This exists so "+" in
// BottomNav goes somewhere real, reusing the same upload -> generate call
// the previous dashboard wiring already had. No visual design pass here.
export default function CreatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUploaded(result: UploadResult) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageKey: result.key, idempotencyKey: crypto.randomUUID() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed to start generation (${res.status})`);
      router.push(`/models/${body.modelId}/waiting`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <UploadDropzone onUploaded={handleUploaded} />
      {busy && <p className="text-small uppercase tracking-wide text-text-muted">Starting generation…</p>}
      {error && <p className="text-small text-danger">{error}</p>}
    </div>
  );
}
