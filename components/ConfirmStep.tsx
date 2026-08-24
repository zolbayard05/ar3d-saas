"use client";

import { X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useCredits } from "@/hooks/useCredits";

export interface ConfirmStepProps {
  previewUrl: string;
  userId: string;
  onRetake: () => void;
  onCreate: () => void;
  creating: boolean;
  error: string | null;
}

// Credit cost is a literal 1 (consume_credit's `credits = credits - 1`,
// migration 0001) — not derived from anywhere else, since there's nowhere
// else in the schema that expresses "cost per generation" as a value.
const CREDIT_COST = 1;

// Reference: a Tripo screenshot (2026-08-24) — large photo, a small corner
// close button standing in for a separate "retake" action, one dominant
// bottom action. Adapted rather than copied: no face-limit/quality controls
// (rule 21's retry logic is internal, never user-facing), and the bottom
// action reuses ModelDetail.tsx's AR-button treatment (rounded-full,
// icon-free here since there's no icon that reads as "create," shadow-card)
// for one consistent "primary floating action" language across the app
// rather than a second button style.
//
// Renders below CaptureFlow.tsx's own CaptureChoice cards, not as a
// separate full-screen step (2026-08-24) — no padding/nav-clearance of its
// own, CaptureFlow's shared wrapper owns that once for every phase.
export function ConfirmStep({ previewUrl, userId, onRetake, onCreate, creating, error }: ConfirmStepProps) {
  // previewUrl's blob-URL lifecycle (create/revoke) lives in CaptureFlow.tsx
  // now, not here — GeneratingStep needs the same preview after this
  // component unmounts, so it has to outlive this one step.
  const { credits, loading } = useCredits(userId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-card bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="Captured photo" className="max-h-full max-w-full object-contain" />

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

      <div className="flex flex-col items-center gap-3 pt-6">
        <p className="text-small uppercase tracking-wide text-text-muted">
          {CREDIT_COST} credit · {loading ? "…" : `${Math.max((credits ?? 0) - CREDIT_COST, 0)} remaining`}
        </p>

        {error && <p className="text-small text-danger">{error}</p>}

        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-body font-semibold uppercase tracking-wide text-accent-text shadow-card hover:bg-accent-hover disabled:opacity-50"
        >
          {creating && <Spinner size="sm" />}
          Create
        </button>
      </div>
    </div>
  );
}
