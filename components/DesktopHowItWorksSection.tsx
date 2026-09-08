"use client";

// New section, inserted right after DesktopHeroTumble.tsx (DesktopLanding.tsx)
// — cements "this is an extension, here's exactly how it works" immediately
// after the hero, before DesktopIntroSection's merchant/multiview pitch.
// id="how-it-works" is the nav's real anchor target (see DesktopLanding.tsx's
// own comment on why 4 of 5 nav links were previously dead).
//
// Visual language reuses DesktopPipelineSection's numbered-row rhythm
// (same section that just got hover polish) rather than inventing new
// chrome — a connecting vertical line + IntersectionObserver-driven
// "active row" highlight is the one new interaction, matching this
// codebase's existing minimal, hand-rolled-animation convention (no
// scrollytelling library, same class of technique as the hero's own
// scroll handler).

import { useEffect, useRef, useState } from "react";

const MUTED_TEXT = "rgb(203, 208, 191)";

const STEPS = [
  { num: "01", label: "Нээж үзэх", body: "Дурын дэмжигдсэн онлайн дэлгүүрийн сайт дээр бүтээгдэхүүнээ үз." },
  {
    num: "02",
    label: "Идэвхжүүлэх",
    body: "Realify3D Chrome Extension-ийг ажиллуул.",
    // Chrome extension isn't relevant on a phone — mobile gets its own
    // copy for this one step instead (dual-rendered below via lg:).
    mobileLabel: "Зураг оруулах",
    mobileBody: "Ганц эсвэл хэд хэдэн өнцгөөс авсан зургаа шууд аппад оруул.",
  },
  { num: "03", label: "Судлах", body: "Бүтээгдэхүүнийг 3D-ээр эргүүлж, ойртуулж, дэлгэрэнгүй хар." },
  { num: "04", label: "AR-аар турших", body: "Боломжтой бүтээгдэхүүнийг өөрийн орчинд AR-аар турш." },
];

export function DesktopHowItWorksSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = rowRefs.current.findIndex((el) => el === entry.target);
          if (idx !== -1) setActiveIdx(idx);
        });
      },
      // Narrow band centered on the viewport's own middle — a row counts
      // as "active" once it crosses roughly the vertical center, not the
      // moment it merely enters the viewport at the bottom edge.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    rowRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="bg-[#0a0b0c] px-6 py-24 lg:px-16 lg:py-[160px]">
      <div className="mx-auto max-w-[1110px]">
        <p
          className="uppercase"
          style={{ fontSize: "10px", fontWeight: 400, color: "rgb(174, 177, 165)", letterSpacing: "1.5px", marginBottom: "20px" }}
        >
          Хэрхэн ажилладаг
        </p>
        <h2
          className="text-balance text-[#f5f4ef]"
          style={{
            fontSize: "clamp(2.2rem, 4.95vw, 5.9375rem)",
            fontWeight: 650,
            lineHeight: 0.91,
            letterSpacing: "-0.075em",
            marginBottom: "72px",
          }}
        >
          Дөрвөн алхам.
          <br />
          <em className="hidden not-italic lg:inline" style={{ color: MUTED_TEXT, fontWeight: 450 }}>
            Нэг өргөтгөл.
          </em>
          <em className="not-italic lg:hidden" style={{ color: MUTED_TEXT, fontWeight: 450 }}>
            Нэг апп.
          </em>
        </h2>

        <div className="relative grid grid-cols-[3rem_1fr] gap-0">
          {/* The connecting line — a static muted track, plus a bright
              fill segment whose height tracks activeIdx. Positioned to
              run through the row numbers' own column. */}
          <div
            aria-hidden="true"
            className="absolute top-2 hidden w-px sm:block"
            style={{ left: "23px", bottom: "2px", background: "rgb(48, 49, 46)" }}
          />
          <div
            aria-hidden="true"
            className="absolute top-2 hidden w-px transition-[height] duration-500 ease-out sm:block"
            style={{
              left: "23px",
              background: MUTED_TEXT,
              height: `calc(${activeIdx} / ${STEPS.length - 1} * (100% - 16px))`,
            }}
          />

          {STEPS.map((step, i) => (
            <div key={step.num} className="col-span-2 grid grid-cols-subgrid items-start gap-x-4 gap-y-2 py-6">
              <span
                className="relative flex size-8 items-center justify-center rounded-full transition-colors duration-500"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: i === activeIdx ? "rgb(20, 21, 17)" : "rgb(174, 177, 165)",
                  background: i === activeIdx ? MUTED_TEXT : "transparent",
                  border: i === activeIdx ? "none" : "1px solid rgb(48, 49, 46)",
                }}
              >
                {i + 1}
              </span>
              <div
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
              >
                <p
                  className={`uppercase transition-colors duration-500 ${step.mobileLabel ? "hidden lg:block" : ""}`}
                  style={{ fontSize: "16px", fontWeight: 650, letterSpacing: "0.02em", color: i === activeIdx ? "#f5f4ef" : "rgb(150, 152, 145)" }}
                >
                  {step.label}
                </p>
                {step.mobileLabel && (
                  <p
                    className="uppercase transition-colors duration-500 lg:hidden"
                    style={{ fontSize: "16px", fontWeight: 650, letterSpacing: "0.02em", color: i === activeIdx ? "#f5f4ef" : "rgb(150, 152, 145)" }}
                  >
                    {step.mobileLabel}
                  </p>
                )}
                <p
                  className={`mt-1 transition-colors duration-500 ${step.mobileBody ? "hidden lg:block" : ""}`}
                  style={{ maxWidth: "420px", fontSize: "15px", lineHeight: "22px", color: i === activeIdx ? "rgb(203, 208, 191)" : "rgb(115, 117, 111)" }}
                >
                  {step.body}
                </p>
                {step.mobileBody && (
                  <p
                    className="mt-1 transition-colors duration-500 lg:hidden"
                    style={{ maxWidth: "420px", fontSize: "15px", lineHeight: "22px", color: i === activeIdx ? "rgb(203, 208, 191)" : "rgb(115, 117, 111)" }}
                  >
                    {step.mobileBody}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
