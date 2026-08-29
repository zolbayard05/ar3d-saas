"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui/Button";
import { MasonryGrid } from "@/components/MasonryGrid";
import { SignOutButton } from "@/components/SignOutButton";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";
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
export function LibraryFeed({
  userId,
  initialModels,
  initialCredits,
}: LibraryFeedProps) {
  const [models, setModels] = useState(initialModels);
  const [retryError, setRetryError] = useState<string | null>(null);
  const { credits, loading } = useCredits(userId, initialCredits);

  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase");
  const [purchaseStatus, setPurchaseStatus] = useState<{
    kind: "success" | "pending" | "error";
    message: string;
  } | null>(null);

  // Fallback confirmation for a wire.mn purchase (app/api/checkout/confirm)
  // — see lib/wire.ts's getPaymentIntent comment for why this exists at
  // all (the webhook endpoint got stuck pending and wire.mn never sent it
  // a single verification ping, confirmed via Vercel's own logs). Runs
  // once per purchaseId: router.replace strips the query param immediately
  // so a refresh doesn't re-trigger it, and complete_credit_purchase's own
  // idempotency guard makes a genuine double-call harmless regardless.
  // Credits themselves update via useCredits' existing Realtime
  // subscription once the RPC lands — no need to also update `credits`
  // locally here.
  useEffect(() => {
    if (!purchaseId) return;
    router.replace("/library");

    fetch("/api/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseId }),
    })
      .then((res) => res.json())
      .then((body) => {
        if (body.status === "completed") {
          setPurchaseStatus({
            kind: "success",
            message: "Кредит амжилттай нэмэгдлээ!",
          });
        } else if (body.error) {
          setPurchaseStatus({ kind: "error", message: body.error });
        } else {
          setPurchaseStatus({
            kind: "pending",
            message:
              "Төлбөр боловсруулагдаж байна — түр хүлээгээд хуудсаа шинэчилнэ үү.",
          });
        }
      })
      .catch(() =>
        setPurchaseStatus({
          kind: "error",
          message: "Төлбөрийг баталгаажуулахад алдаа гарлаа",
        }),
      );
  }, [purchaseId, router]);

  async function handleRetry(model: ModelRow) {
    setRetryError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageKey: model.source_image_key,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          body.error ?? `Дахин оролдоход алдаа гарлаа (${res.status})`,
        );

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
      setRetryError(
        err instanceof Error ? err.message : "Дахин оролдоход алдаа гарлаа",
      );
    }
  }

  function handleDelete(model: ModelRow) {
    setModels((prev) => prev.filter((m) => m.id !== model.id));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Own header, same weight/position as HomeFeed's "Realify" wordmark
          (rule 38) but reading "My Models" — this screen's own identity,
          not a duplicate of the home feed's. Title + metadata line stacked
          with gap-1 reuses ModelDetail.tsx's exact title/dimensions
          pattern rather than inventing new spacing. "Нэмэх" now links to
          /credits (components/BuyCredits.tsx) — real checkout isn't wired
          up yet (pending wire.mn merchant approval), but the pack-browsing
          screen itself is real, not a placeholder link. Stays visible at
          lg+ (unlike HomeFeed's own wordmark header, which hides there) —
          the credit count and "Нэмэх" link are page-specific information
          Sidebar doesn't carry, not a duplicate brand mark, so hiding it
          would lose real content, not just repetition. Just capped/
          centered at lg+ to match the grid below (rule 40 — HomeFeed.tsx
          established this max-w-feed convention, reused exactly here). */}
      <div className="flex shrink-0 flex-col gap-1 px-2 pt-4 pb-3 lg:mx-auto lg:w-full lg:max-w-feed lg:px-6 lg:pt-6">
        <p className="text-body font-semibold text-text">Миний Model</p>
        <div className="flex items-center gap-2">
          <p className="text-small uppercase tracking-wide text-text-muted">
            {loading ? "…" : `${credits ?? 0} кредит үлдсэн`}
          </p>
          <Link
            href="/credits"
            className="text-small uppercase tracking-wide text-text-muted hover:text-text"
          >
            · Нэмэх
          </Link>
        </div>
      </div>

      {purchaseStatus && (
        <p
          className={cn("px-2 py-2 text-small lg:px-6", {
            "text-success": purchaseStatus.kind === "success",
            "text-danger": purchaseStatus.kind === "error",
            "text-text-muted": purchaseStatus.kind === "pending",
          })}
        >
          {purchaseStatus.message}
        </p>
      )}

      {retryError && (
        <p className="px-2 py-2 text-small text-danger lg:px-6">{retryError}</p>
      )}

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:pt-6"
        // --bottom-nav-reserve (styles/tokens.css) is 6rem on mobile,
        // clearing BottomNav, and 2.5rem at lg+ (Sidebar replaces
        // BottomNav there — see HomeFeed.tsx's identical comment on why
        // this has to be a CSS variable rather than a Tailwind lg: class).
        // var(--install-bar-reserve) is 0px whenever
        // components/InstallPrompt.tsx isn't showing a bar.
        style={{
          paddingBottom:
            "calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-reserve) + var(--install-bar-reserve, 0px))",
        }}
      >
        {/* lg:my-auto — same auto-margin centering as HomeFeed.tsx (see its
            identical comment on why not justify-center); competes for
            space with the footer's own lg:mt-auto below, which in practice
            reads as "content settles a bit below the top instead of
            pinned flush to it, footer still anchors the very bottom" —
            still a real improvement over a short list sitting at the top
            of a mostly-empty tall column. */}
        <div className="w-full lg:mx-auto lg:my-auto lg:max-w-feed">
          {models.length === 0 ? (
            <EmptyState
              className="m-4 lg:mx-6 lg:mt-16 lg:max-w-md"
              title="Эхний model-оо үүсгээрэй"
              action={
                <Link
                  href="/create"
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  Үүсгэх
                </Link>
              }
            />
          ) : (
            <MasonryGrid
              models={models}
              onRetry={handleRetry}
              onDelete={handleDelete}
            />
          )}
        </div>

        {/* Bottom: three small grey text links — no settings list, no
            avatar, no display name (nothing to show anyway; rule 38/40 kept
            this screen to exactly what was asked for). */}
        <div className="mt-auto flex items-center justify-center gap-6 pt-8">
          <button
            type="button"
            className="text-small uppercase tracking-wide text-text-muted hover:text-text"
          >
            Багц
          </button>
          <button
            type="button"
            className="text-small uppercase tracking-wide text-text-muted hover:text-text"
          >
            Тусламж
          </button>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
