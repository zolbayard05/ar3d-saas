// New section, inserted right after DesktopShowcaseSection (AR) — the nav's
// "Үнэ" link (DesktopLanding.tsx) points here. Unlike the "Chrome-д нэмэх"
// CTAs elsewhere on this page (which open DesktopWaitlistCta's waitlist
// dialog because the Chrome extension isn't published yet), the credit/
// generate flow itself is real and already live — CREDIT_PACKS/BuyCredits.tsx
// checkout is wired to wire.mn — so this section's CTA is a real `/login`
// link, not another waitlist form.
//
// Pricing numbers are pulled directly from lib/creditPacks.ts (the same
// source components/BuyCredits.tsx renders inside the app) rather than
// duplicated as separate copy — this section and the real purchase screen
// can never silently drift out of sync.
//
// Visual language matches the rest of the page's dark bands (Desktop
// HowItWorksSection/DesktopIntroSection's #0a0b0c, card treatment borrowed
// from DesktopCategoriesSection's corner-glow cards) rather than the app's
// own bento/glass token system — Desktop*.tsx stays token-exempt, see file
// headers throughout this directory.

import Link from "next/link";
import { ArrowUpRight, Zap } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/creditPacks";

const PACK_COPY: Record<string, string> = {
  "pack-5": "Түргэн турших, цөөн загвар хийхэд.",
  "pack-15": "Ихэнх хэрэглэгчийн сонголт.",
  "pack-40": "Байнга ашигладаг, олон загвар хэрэгтэй бол.",
};

export function DesktopPricingSection() {
  return (
    <section id="pricing" className="bg-[#0a0b0c] px-6 py-24 lg:px-16 lg:py-[160px]">
      <div className="mx-auto max-w-[1400px]">
        <p
          className="uppercase"
          style={{ fontSize: "10px", fontWeight: 400, color: "rgb(174, 177, 165)", letterSpacing: "1.5px", marginBottom: "20px" }}
        >
          Үнийн санал
        </p>
        <h2
          className="text-balance text-[#f5f4ef]"
          style={{
            fontSize: "clamp(2.2rem, 4.95vw, 5.9375rem)",
            fontWeight: 650,
            lineHeight: 0.91,
            letterSpacing: "-0.075em",
            marginBottom: "28px",
          }}
        >
          Энгийн, ил тод
          <br />
          <em className="not-italic" style={{ color: "rgb(203, 208, 191)", fontWeight: 450 }}>
            үнэ.
          </em>
        </h2>
        <p style={{ maxWidth: "480px", fontSize: "16px", fontWeight: 400, lineHeight: "24px", color: "rgb(181, 183, 173)", marginBottom: "40px" }}>
          Сарын төлбөр, захиалга байхгүй — хэрэгцээндээ тохирсон багц худалдаж аваад л шууд ашиглаж эхэлнэ.
        </p>

        {/* The "1 credit = 1 model" explainer the user asked for, as a
            standalone callout pill rather than buried in a paragraph — it's
            the single fact a first-time visitor most needs before the price
            grid below makes sense. */}
        <div
          className="mb-16 flex w-fit items-center gap-3 rounded-full px-5 py-3"
          style={{ background: "rgb(20, 21, 17)", border: "1px solid rgb(48, 49, 46)" }}
        >
          <span
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{ width: "26px", height: "26px", background: "rgb(223, 227, 210)", color: "rgb(20, 21, 17)" }}
          >
            <Zap className="size-3.5" />
          </span>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "rgb(240, 240, 235)" }}>
            1 кредит = 1 бэлэн 3D загвар
            <span style={{ color: "rgb(174, 177, 165)", fontWeight: 400 }}> — GLB + USDZ, AR-д шууд бэлэн.</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => {
            const perCredit = Math.round(pack.amountMnt / pack.credits);
            return (
              <div
                key={pack.id}
                className="group relative flex flex-col gap-8 overflow-hidden rounded-2xl p-8"
                style={{
                  background: "rgb(20, 21, 17)",
                  border: pack.highlight ? "1px solid rgb(223, 227, 210)" : "1px solid rgb(48, 49, 46)",
                }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-10 -right-8 size-32 rounded-full blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: "rgb(223 227 210 / 0.16)", opacity: pack.highlight ? 1 : 0.4 }}
                />

                <div className="relative flex items-center justify-between">
                  <span
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                    style={{ background: "rgb(255 255 255 / 0.06)", border: "1px solid rgb(48, 49, 46)", fontSize: "12px", fontWeight: 500, color: "rgb(240, 240, 235)" }}
                  >
                    <Zap className="size-3.5" />
                    {pack.credits} кредит
                  </span>
                  {pack.highlight && (
                    <span
                      className="uppercase"
                      style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "1px", color: "rgb(20, 21, 17)", background: "rgb(223, 227, 210)", padding: "4px 8px", borderRadius: "999px" }}
                    >
                      Түгээмэл
                    </span>
                  )}
                </div>

                <div className="relative">
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontSize: "36px", fontWeight: 650, letterSpacing: "-0.02em", color: "rgb(245, 244, 239)" }}>
                      {pack.amountMnt.toLocaleString("mn-MN")}₮
                    </span>
                  </div>
                  <p style={{ marginTop: "4px", fontSize: "12px", fontWeight: 400, color: "rgb(174, 177, 165)" }}>
                    ~{perCredit.toLocaleString("mn-MN")}₮ / загвар
                  </p>
                </div>

                <p className="relative" style={{ fontSize: "13px", fontWeight: 400, lineHeight: "19px", color: "rgb(181, 183, 173)" }}>
                  {PACK_COPY[pack.id]}
                </p>
              </div>
            );
          })}
        </div>

        <Link
          href="/login"
          className="mt-12 inline-flex items-center gap-1.5 hover:opacity-80"
          style={{ fontSize: "12px", fontWeight: 700, color: "rgb(245, 244, 239)" }}
        >
          Нэвтэрч, багц худалдаж авах
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
