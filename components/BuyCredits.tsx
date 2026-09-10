"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { CREDIT_PACKS, applyFirstPurchaseDiscount } from "@/lib/creditPacks";

// Same three lines DesktopPricingSection.tsx's own PACK_COPY uses on the
// landing page — kept as a separate local copy rather than a shared
// import since that file is intentionally token-exempt/raw-hex (see its
// own header comment) while this one is token-only; duplicating three
// short strings is simpler than threading a shared constant across that
// styling boundary.
const PACK_COPY: Record<string, string> = {
  "pack-5": "Түргэн турших, цөөн загвар хийхэд.",
  "pack-15": "Ихэнх хэрэглэгчийн сонголт.",
  "pack-40": "Байнга ашигладаг, олон загвар хэрэгтэй бол.",
};

export interface BuyCreditsProps {
  /** Resolved server-side (app/(app)/credits/page.tsx) via lib/checkout.ts's isFirstPurchaseEligible — the same check startCheckout() itself gates the real charge on, so this never shows a price the actual wire.mn checkout won't honor. */
  isFirstPurchaseEligible?: boolean;
}

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
export function BuyCredits({ isFirstPurchaseEligible }: BuyCreditsProps) {
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

      {/* This screen's own content was previously a plain (non-scrolling)
          flex-col sibling of the header above — invisible on desktop
          (where the viewport is usually tall enough to fit everything) but
          the app shell itself has no page-level scroll at all (app/(app)/
          layout.tsx is `fixed inset-0`), so on a phone where the content
          genuinely doesn't fit (confirmed live on an iPhone 12 Pro,
          390x844: the third pack card was cut off with no way to reach
          it), there was no way to scroll to the rest. overflow-y-auto here
          — same two-level header+scrollable-body pattern LibraryFeed.tsx/
          HomeFeed.tsx already use — plus --bottom-nav-reserve (styles/
          tokens.css) so the last card clears the floating BottomNav dock
          instead of sitting behind it. No visible scrollbar either way —
          app/globals.css hides scrollbars globally. */}
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 lg:mx-auto lg:w-full lg:max-w-xl lg:px-0 lg:pt-6"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-reserve))",
        }}
      >
        <div className="flex flex-col gap-1">
          <p className="text-heading font-semibold text-text">Кредит нэмэх</p>
          <p className="text-small text-text-muted">
            1 кредит = 1 бэлэн 3D загвар — GLB + USDZ, AR-д шууд бэлэн.
          </p>
        </div>

        {/* First-purchase discount banner — only rendered when the server
            (app/(app)/credits/page.tsx) resolved this specific user as
            eligible, so it's never shown alongside a price that doesn't
            actually carry the discount. */}
        {isFirstPurchaseEligible && (
          <div className="flex items-center gap-3 rounded-card border border-success/25 bg-success/10 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
              <Sparkles className="size-4" />
            </span>
            <p className="text-small text-text">
              Эхний худалдан авалтад{" "}
              <span className="font-semibold text-success">−50%</span> хямдрал идэвхтэй байна.
            </p>
          </div>
        )}

        {/* grid-cols-1 base — with the richer per-card content added below
            (rate line + description), a half-width column on a phone
            wraps the credit-count pill onto 2 lines (reproduced live at
            173px). Bento 2-col only from sm: (640px) up, where there's
            room for it. grid-flow-dense there too — default sparse
            placement left the two col-span-1 packs each alone in their
            own row with a same-color empty cell beside them (invisible
            against the dark background, but real dead space — reproduced
            live via getBoundingClientRect: an unused 328px gap next to
            both). Dense backfills pack-40 into that hole next to pack-5
            instead, so both narrow packs actually sit side by side. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:grid-flow-dense">
          {CREDIT_PACKS.map((pack) => {
            const pending = pendingPackId === pack.id;
            const disabled = pendingPackId !== null;
            const displayAmountMnt = isFirstPurchaseEligible
              ? applyFirstPurchaseDiscount(pack.amountMnt)
              : pack.amountMnt;
            const perCredit = Math.round(displayAmountMnt / pack.credits);

            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => handleBuy(pack.id)}
                disabled={disabled}
                className={cn(
                  "group relative flex flex-col gap-4 overflow-hidden rounded-card border border-glass-border bg-surface-hover p-5 text-left shadow-glass-card transition-all hover:border-glass-border-hover hover:opacity-90 disabled:opacity-40",
                  pack.highlight ? "sm:col-span-2" : "sm:col-span-1",
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
                    "pointer-events-none absolute -top-10 -right-8 size-32 rounded-full blur-2xl transition-opacity group-hover:opacity-100",
                    pack.highlight ? "bg-glow-soft" : "bg-glow-faint",
                  )}
                />
                <div className="relative flex items-start justify-between gap-2">
                  {/* Was bg-accent-text/10 — near-black at 10% opacity on an
                      already-dark card, functionally invisible. Glass pill
                      (glow-soft fill + hairline border) so this badge is
                      actually visible, matching the design proposal. */}
                  <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-glass-border bg-glow-soft px-2 py-0.5 text-small text-text">
                    <Zap className="size-3.5" />
                    {pack.credits} кредит
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isFirstPurchaseEligible && <Badge variant="success">−50%</Badge>}
                    {pack.highlight && <Badge variant="accent">Түгээмэл</Badge>}
                  </div>
                </div>

                {pending ? (
                  <Spinner size="sm" />
                ) : (
                  <div className="relative flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      {isFirstPurchaseEligible && (
                        <span className="text-small text-text-muted line-through">
                          {pack.amountMnt.toLocaleString("mn-MN")}₮
                        </span>
                      )}
                      <span
                        className={cn(
                          "font-semibold text-text",
                          pack.highlight ? "text-heading" : "text-body",
                        )}
                      >
                        {displayAmountMnt.toLocaleString("mn-MN")}₮
                      </span>
                    </div>
                    <p className="text-small text-text-muted">
                      ~{perCredit.toLocaleString("mn-MN")}₮ / загвар
                    </p>
                  </div>
                )}

                <p className="relative text-small text-text-muted">{PACK_COPY[pack.id]}</p>
              </button>
            );
          })}
        </div>

        {error && <p className="text-small text-danger">{error}</p>}
      </div>
    </div>
  );
}
