// Final section + footer. Every style value below is copied verbatim from
// getComputedStyle() against the reference mockup's own document, same
// method as the other sections.

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function DesktopFinalCta() {
  return (
    <>
      <section className="grid lg:grid-cols-2" style={{ background: "#050505" }}>
        <div className="flex flex-col justify-center px-6 py-24 lg:px-16 lg:py-[140px]">
          <p
            className="uppercase"
            style={{ fontSize: "10px", fontWeight: 400, color: "rgb(174, 177, 165)", letterSpacing: "1.5px", marginBottom: "20px" }}
          >
            Таны каталог, шинэ хэлбэрээр
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
            Таны бүтээгдэхүүн
            <br />
            <em className="not-italic" style={{ color: "rgb(203, 208, 191)", fontWeight: 450 }}>
              3D хэлбэртэй байх учиртай.
            </em>
          </h2>
          <p style={{ maxWidth: "430px", fontSize: "17px", fontWeight: 400, lineHeight: "25.5px", color: "rgb(181, 183, 173)", marginBottom: "32px" }}>
            Каталогоо гүн шингэсэн дижитал туршлага болгон хувиргаж эхлээрэй.
          </p>
          <Link
            href="/login"
            className="flex w-fit items-center gap-2 bg-[#eeeee9] uppercase text-[#111111] hover:opacity-90"
            style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.33px", lineHeight: "16.5px", padding: "17px 20px" }}
          >
            Эхний 3D загвараа үүсгэ
            <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="relative aspect-square lg:aspect-auto" aria-hidden="true">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative size-[55%] overflow-hidden rounded-[9999px]" style={{ background: "rgb(36 38 34)" }}>
              <div
                style={{
                  position: "absolute",
                  inset: "-20%",
                  background: "linear-gradient(35deg, transparent 45%, rgb(255 255 255 / 0.35) 50%, transparent 55%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "10%",
                  right: "14%",
                  width: "26%",
                  height: "26%",
                  borderRadius: "9999px",
                  background: "rgb(10 11 9 / 0.6)",
                }}
              />
            </div>
          </div>
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
          AI-ААР ХӨГЖҮҮЛСЭН 3D АРИЛЖААНЫ ДЭД БҮТЭЦ
        </span>
        <span className="uppercase" style={{ fontSize: "9px", fontWeight: 400, color: "rgb(119, 121, 113)", letterSpacing: "0.81px" }}>
          БОДИТ ЕРТӨНЦӨД ЗОРИУЛАГДСАН
        </span>
      </footer>
    </>
  );
}
