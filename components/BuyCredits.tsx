"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { CREDIT_PACKS } from "@/lib/creditPacks";

// Reuses ModelDetail.tsx's exact h-12 back-arrow header bar (rule 40: no
// new header pattern per screen).
//
// Bento-grid layout (2026-08-29, Pinterest research into current dark-UI
// pricing patterns): the highlighted pack spans both columns as a larger
// "hero" card, the other two sit side by side — asymmetric card sizing
// instead of a uniform stacked list, still built entirely from existing
// tokens (border-border-subtle, shadow-card, rounded-card) rather than
// any new color/style.
//
// Live checkout (2026-08-29) — wire.mn merchant approval + operator
// activation both completed, app/api/checkout/route.ts verified working
// against the real API. amountMnt in lib/creditPacks.ts is what actually
// gets charged now, not a placeholder — update that comment/these numbers
// together if the pricing itself is still meant to change.
export function BuyCredits() {
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(packId: string) {
    setError(null);
    setPendingPackId(packId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, idempotencyKey: crypto.randomUUID() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          body.error ?? `Төлбөр эхлүүлэхэд алдаа гарлаа (${res.status})`,
        );

      // Full navigation, not a client-side route change — the destination
      // is pay.wire.mn, a different origin entirely. .assign(), not a
      // `window.location.href =` property write — the latter trips this
      // project's react-hooks/immutability lint rule ("modifying a
      // variable defined outside a component"), which reads a plain
      // assignment as component-render-time state mutation even though
      // this only ever runs inside an event handler, well after render.
      window.location.assign(body.url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Төлбөр эхлүүлэхэд алдаа гарлаа",
      );
      setPendingPackId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center px-4 lg:mx-auto lg:w-full lg:max-w-xl lg:px-0">
        <Link
          href="/library"
          aria-label="Буцах"
          className="text-text-muted hover:text-text"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-2 lg:mx-auto lg:w-full lg:max-w-xl lg:px-0 lg:pt-6">
        <p className="text-body font-semibold text-text">Кредит нэмэх</p>
        <p className="text-small text-text-muted">
          1 кредит = 1 3D загвар (GLB + USDZ, AR-д бэлэн).
        </p>

        <div className="grid grid-cols-2 gap-3">
          {CREDIT_PACKS.map((pack) => {
            const pending = pendingPackId === pack.id;
            const disabled = pendingPackId !== null;

            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => handleBuy(pack.id)}
                disabled={disabled}
                className={cn(
                  "relative flex flex-col justify-between gap-4 overflow-hidden rounded-card border border-glass-border bg-surface-hover p-5 text-left shadow-glass-card transition-opacity hover:opacity-90 disabled:opacity-40",
                  pack.highlight ? "col-span-2" : "col-span-1",
                )}
              >
                {/* Corner glow (2026-08-29, glow/glass redesign) — a very
                    faint white bloom bleeding from one corner, brighter on
                    the highlighted pack, so the tile reads as a lit
                    surface rather than a flat block. Still no accent hue —
                    bg-glow-soft/bg-glow-faint are pure white at low
                    opacity, same rule --color-accent already established. */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -top-10 -right-8 size-32 rounded-full blur-2xl",
                    pack.highlight ? "bg-glow-soft" : "bg-glow-faint",
                  )}
                />
                <div className="relative flex items-start justify-between">
                  <span className="flex items-center gap-1 rounded-full bg-accent-text/10 px-2 py-0.5 text-small text-text">
                    <Zap className="size-3.5" />
                    {pack.credits}
                  </span>
                  {pack.highlight && (
                    <span className="text-small uppercase tracking-wide text-text-muted">
                      Түгээмэл
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "relative flex items-center gap-2 font-medium text-text",
                    pack.highlight ? "text-heading" : "text-body",
                  )}
                >
                  {pending ? (
                    <Spinner size="sm" />
                  ) : (
                    `${pack.amountMnt.toLocaleString("mn-MN")}₮`
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-small text-danger">{error}</p>}
      </div>
    </div>
  );
}
