"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Trash2, Check } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { formatDimensionsCm } from "@/lib/models";
import { deleteModel } from "@/lib/deleteModel";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

// Second place ARViewer is imported from (ModelDetail.tsx is the other) —
// rule 11 itself just requires ssr:false via next/dynamic, not a single
// call site; both follow it correctly.
const ARViewer = dynamic(() => import("@/components/ARViewer").then((m) => m.ARViewer), {
  ssr: false,
  loading: () => (
    <div
      className="flex aspect-[4/5] w-full items-center justify-center"
      style={{
        background: "radial-gradient(circle at 50% 38%, var(--color-surface-hover), var(--color-bg) 75%)",
      }}
    >
      <Spinner size="lg" label="Ачаалж байна" />
    </div>
  ),
});

export interface ResultStepProps {
  model: ModelRow;
  onSaved: () => void;
  onDeleted: () => void;
}

// Shown in place, inside /create, right when a generation finishes — the
// decision point CaptureFlow.tsx routes through instead of redirecting
// straight to /models/[id]: Save keeps it (it's already a normal `ready`
// row; nothing more to persist) and goes to the real detail page, Delete
// removes it via the same lib/deleteModel.ts every other delete action
// uses. Nothing lands in My Models (library/page.tsx's own status filter)
// without one of those two choices being made here first.
//
// Renders below CaptureFlow.tsx's own CaptureChoice cards, not as a
// separate full-screen step — no padding/nav-clearance of its own,
// CaptureFlow's shared wrapper owns that once for every phase.
export function ResultStep({ model, onSaved, onDeleted }: ResultStepProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    if (await deleteModel(model.id)) {
      onDeleted();
    } else {
      setDeleting(false);
    }
  }

  const dims = formatDimensionsCm(model);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ARViewer
        glbKey={model.glb_url as string}
        usdzKey={model.usdz_url as string}
        scale={model.scale}
        alt={model.title || undefined}
        className="aspect-[4/5]! h-auto! w-full"
      />

      <div className="flex flex-col gap-1 pt-4">
        <p className="text-heading font-semibold text-text">{model.title || "Нэргүй"}</p>
        {dims && <p className="text-small uppercase tracking-wide text-text-muted">{dims}</p>}
      </div>

      <div className="mt-auto flex gap-3 pt-6">
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-surface-hover text-body font-semibold uppercase tracking-wide text-text hover:opacity-90 disabled:opacity-50"
        >
          {deleting ? <Spinner size="sm" /> : <Trash2 className="size-5" />}
          Устгах
        </button>
        <button
          type="button"
          onClick={onSaved}
          disabled={deleting}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-accent text-body font-semibold uppercase tracking-wide text-accent-text shadow-card hover:bg-accent-hover disabled:opacity-50"
        >
          <Check className="size-5" />
          Хадгалах
        </button>
      </div>
    </div>
  );
}
