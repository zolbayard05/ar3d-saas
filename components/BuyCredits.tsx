"use client";

import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { CREDIT_PACKS } from "@/lib/creditPacks";

// Reuses ModelDetail.tsx's exact h-12 back-arrow header bar (rule 40:
// no new header pattern per screen). No checkout wiring yet — the
// wire.mn integration is deliberately deferred (2026-08-28) until (a)
// merchant approval comes back and (b) the real API is read directly
// against a sandbox key, per this project's established pattern of not
// building against unverified third-party API assumptions (see the
// Tripo integration's own caveats). Every pack is disabled and labeled
// "Тун удахгүй" so this reads as a real, if unfinished, screen — not a
// dead end pretending to be live.
//
// Bento-grid layout (2026-08-29, Pinterest research into current dark-UI
// pricing patterns): the highlighted pack spans both columns as a larger
// "hero" card, the other two sit side by side — asymmetric card sizing
// instead of a uniform stacked list, still built entirely from existing
// tokens (border-border-subtle, shadow-card, rounded-card) rather than
// any new color/style.
export function BuyCredits() {
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
        <p className="text-small text-text-muted">
          Төлбөрийн систем тун удахгүй нэмэгдэнэ. Доорх багцууд нь эцсийн үнэ
          биш, зөвхөн жишээ.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={cn(
                "flex flex-col justify-between gap-4 rounded-card border border-border-subtle bg-surface-hover p-5 opacity-60 shadow-card",
                pack.highlight ? "col-span-2" : "col-span-1",
              )}
            >
              <div className="flex items-start justify-between">
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
                  "font-medium text-text",
                  pack.highlight ? "text-heading" : "text-body",
                )}
              >
                {pack.amountMnt.toLocaleString("mn-MN")}₮
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-small uppercase tracking-wide text-text-muted">
          Тун удахгүй
        </p>
      </div>
    </div>
  );
}
