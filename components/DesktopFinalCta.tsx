// Closing section + footer — the page's last stop, replacing the removed
// merchant-flow version (that one's own header comment/asset are gone with
// it; see git history commit 3f0ff30 for what this replaces). Every style
// value below reuses the same tokens/scale already established across the
// other sections (DesktopHeroTumble/DesktopHowItWorksSection etc.) rather
// than introducing new ones — no new photo asset either, a centered
// closing CTA doesn't need one.
//
// CTA is the same real DesktopWaitlistCta the nav/hero already use — the
// Chrome Web Store listing isn't published yet, so this stays consistent
// with every other "Chrome-д нэмэх" on the page rather than pointing
// anywhere fake.

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DesktopWaitlistCta } from "@/components/DesktopWaitlistCta";

const MUTED_TEXT = "rgb(203, 208, 191)";

export function DesktopFinalCta() {
  return (
    <>
      <section className="px-6 py-24 lg:px-16 lg:py-[160px]" style={{ background: "#050505" }}>
        <div className="mx-auto flex max-w-[820px] flex-col items-center text-center">
          <p
            className="uppercase"
            style={{ fontSize: "10px", fontWeight: 400, color: "rgb(174, 177, 165)", letterSpacing: "1.5px", marginBottom: "20px" }}
          >
            Бэлэн үү?
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
            Вэбийг 3D-ээр
            <br />
            <em className="not-italic" style={{ color: MUTED_TEXT, fontWeight: 450 }}>
              үзэхэд бэлэн үү?
            </em>
          </h2>
          <p
            className="hidden text-balance lg:block"
            style={{ maxWidth: "480px", fontSize: "17px", fontWeight: 400, lineHeight: "25.5px", color: "rgb(181, 183, 173)", marginBottom: "32px" }}
          >
            Chrome Extension-ээ нэмээд, дурын онлайн дэлгүүрийн бүтээгдэхүүнийг шууд интерактив 3D болон AR-аар үзээрэй.
          </p>
          <p
            className="text-balance lg:hidden"
            style={{ maxWidth: "480px", fontSize: "17px", fontWeight: 400, lineHeight: "25.5px", color: "rgb(181, 183, 173)", marginBottom: "32px" }}
          >
            Зургаа байршуулаад, секундын дотор бэлэн 3D загвар болон AR-аар шалгаарай.
          </p>
          {/* Chrome extension isn't relevant on a phone — the mobile CTA
              reuses the old splash screen's own "Эхлэх" → /login copy
              (that was literally its one job) instead. */}
          <DesktopWaitlistCta
            source="final-cta"
            className="hidden items-center gap-2 bg-[#eeeee9] uppercase text-[#111111] hover:opacity-90 lg:flex"
            style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.33px", lineHeight: "16.5px", padding: "17px 20px" }}
          />
          <Link
            href="/login"
            className="flex items-center gap-2 bg-[#eeeee9] uppercase text-[#111111] hover:opacity-90 lg:hidden"
            style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.33px", lineHeight: "16.5px", padding: "17px 20px" }}
          >
            Эхлэх
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <footer
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-8 lg:px-16"
        style={{ background: "#050505" }}
      >
        <span className="uppercase" style={{ fontSize: "9px", fontWeight: 400, color: "rgb(119, 121, 113)", letterSpacing: "0.81px" }}>
          © 2026 Realify3D
        </span>
        <span className="uppercase" style={{ fontSize: "9px", fontWeight: 400, color: "rgb(119, 121, 113)", letterSpacing: "0.81px" }}>
          Вэб дээрх 3D давхарга
        </span>
        <span className="uppercase" style={{ fontSize: "9px", fontWeight: 400, color: "rgb(119, 121, 113)", letterSpacing: "0.81px" }}>
          Бодит ертөнцөд зориулагдсан
        </span>
      </footer>
    </>
  );
}
