"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui/Button";
import { MasonryGrid } from "@/components/MasonryGrid";
import { SignOutButton } from "@/components/SignOutButton";
import { useCredits } from "@/hooks/useCredits";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface LibraryFeedProps {
  userId: string;
  initialModels: ModelRow[];
  initialCredits: number;
}

// CLAUDE.md rule 40 — reuses the feed's own MasonryGrid/ModelCard directly,
// not a parallel version. Retry logic here matches HomeFeed.tsx's exactly:
// a retry is a genuinely new /api/generate call (own idempotency key, own
// credit deduction), not a resumption of the failed row.
export function LibraryFeed({ userId, initialModels, initialCredits }: LibraryFeedProps) {
  const [models, setModels] = useState(initialModels);
  const [retryError, setRetryError] = useState<string | null>(null);
  const { credits, loading } = useCredits(userId, initialCredits);

  async function handleRetry(model: ModelRow) {
    setRetryError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageKey: model.source_image_key, idempotencyKey: crypto.randomUUID() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed to retry (${res.status})`);

      setModels((prev) => [
        {
          ...model,
          id: body.modelId,
          status: "pending",
          glb_url: null,
          usdz_url: null,
          render_url: null,
          provider_job_id: null,
          usdz_provider_job_id: null,
          idempotency_key: null,
          size_retry_count: 0,
          bbox_width_m: null,
          bbox_depth_m: null,
          bbox_height_m: null,
          error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Failed to retry");
    }
  }

  function handleDelete(model: ModelRow) {
    setModels((prev) => prev.filter((m) => m.id !== model.id));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Own header, same weight/position as HomeFeed's "AR3D" wordmark
          (rule 38) but reading "My Models" — this screen's own identity,
          not a duplicate of the home feed's. Title + metadata line stacked
          with gap-1 reuses ModelDetail.tsx's exact title/dimensions
          pattern rather than inventing new spacing. "Add" has nowhere real
          to go yet (no billing flow exists — Phase 6/Stripe isn't built),
          so it's present but visibly inert rather than a dead link, same
          call as BottomNav's library icon before this screen existed. */}
      <div className="flex shrink-0 flex-col gap-1 px-2 pt-4 pb-3">
        <p className="text-body font-semibold text-text">My Models</p>
        <div className="flex items-center gap-2">
          <p className="text-small uppercase tracking-wide text-text-muted">
            {loading ? "…" : `${credits ?? 0} credits remaining`}
          </p>
          <span className="text-small uppercase tracking-wide text-text-muted opacity-40">· Add</span>
        </div>
      </div>

      {retryError && <p className="px-2 py-2 text-small text-danger">{retryError}</p>}

      <div
        className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto"
        // See components/InstallPrompt.tsx's setFeedBottomReserve — 0px
        // whenever no install bar is showing.
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem + var(--install-bar-reserve, 0px))",
        }}
      >
        {models.length === 0 ? (
          <EmptyState
            className="m-4"
            title="Create your first model"
            action={
              <Link href="/create" className={buttonVariants({ variant: "primary", size: "md" })}>
                Create
              </Link>
            }
          />
        ) : (
          <MasonryGrid models={models} onRetry={handleRetry} onDelete={handleDelete} />
        )}

        {/* Bottom: three small grey text links — no settings list, no
            avatar, no display name (nothing to show anyway; rule 38/40 kept
            this screen to exactly what was asked for). */}
        <div className="mt-auto flex items-center justify-center gap-6 pt-8">
          <button type="button" className="text-small uppercase tracking-wide text-text-muted hover:text-text">
            Plan
          </button>
          <button type="button" className="text-small uppercase tracking-wide text-text-muted hover:text-text">
            Help
          </button>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
