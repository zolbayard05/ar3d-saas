"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { useCredits } from "@/hooks/useCredits";

export interface ConfirmStepProps {
  file: File;
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

export function ConfirmStep({ file, userId, onRetake, onCreate, creating, error }: ConfirmStepProps) {
  // Derived directly from `file`, not effect+state — a blob URL for the
  // same File object is always the same conceptual value, so it doesn't
  // need its own render cycle to "arrive." The effect below only manages
  // revokeObjectURL's cleanup, which is the one genuine side effect here.
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const { credits, loading } = useCredits(userId);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={previewUrl} alt="Captured photo" className="max-h-96 w-auto max-w-full" />

      <p className="text-small uppercase tracking-wide text-text-muted">
        {CREDIT_COST} credit · {loading ? "…" : `${Math.max((credits ?? 0) - CREDIT_COST, 0)} remaining`}
      </p>

      {error && <p className="text-small text-danger">{error}</p>}

      <div className="flex w-full max-w-xs gap-3">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onRetake} disabled={creating}>
          Retake
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={onCreate} loading={creating}>
          Create
        </Button>
      </div>
    </div>
  );
}
