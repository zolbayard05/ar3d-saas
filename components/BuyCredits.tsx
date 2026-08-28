"use client";

import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/creditPacks";

// Reuses ModelDetail.tsx's exact h-12 back-arrow header bar (rule 40:
// no new header pattern per screen) and CaptureChoice.tsx's tile look
// (rounded-sm, bg-surface-hover) for the pack cards. No checkout wiring
// yet — the wire.mn integration is deliberately deferred (2026-08-28)
// until (a) merchant approval comes back and (b) the real API is read
// directly against a sandbox key, per this project's established pattern
// of not building against unverified third-party API assumptions (see
// the Tripo integration's own caveats). Every pack is disabled and
// labeled "Тун удахгүй" so this reads as a real, if unfinished, screen —
// not a dead end pretending to be live.
export function BuyCredits() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center px-4">
        <Link href="/library" aria-label="Буцах" className="text-text-muted hover:text-text">
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-2">
        <p className="text-body font-semibold text-text">Кредит нэмэх</p>
        <p className="text-small text-text-muted">
          Төлбөрийн систем тун удахгүй нэмэгдэнэ. Доорх багцууд нь эцсийн үнэ биш, зөвхөн жишээ.
        </p>

        <div className="flex flex-col gap-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className="flex items-center justify-between rounded-sm bg-surface-hover px-4 py-4 opacity-60"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 rounded-full bg-accent-text/10 px-2 py-0.5 text-small text-text">
                  <Zap className="size-3.5" />
                  {pack.credits}
                </span>
                {pack.highlight && (
                  <span className="text-small uppercase tracking-wide text-text-muted">Түгээмэл</span>
                )}
              </div>
              <span className="text-small font-medium text-text">
                {pack.amountMnt.toLocaleString("mn-MN")}₮
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-small uppercase tracking-wide text-text-muted">Тун удахгүй</p>
      </div>
    </div>
  );
}
