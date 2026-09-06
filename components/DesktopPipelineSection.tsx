// Sixth section (after skipping the mockup's batch-catalog section — see
// git history/conversation: that feature was explicitly shelved as
// unvalidated scope, not something to reproduce even visually). Every
// style value below is copied verbatim from getComputedStyle() against the
// reference mockup's own document, same method as the other sections.
//
// No copy adaptation needed here — every one of these 7 steps is a real
// stage of the actual pipeline (Tripo reconstruction, lib/glbCompress.ts's
// Draco mesh optimization, texture_quality + frequency separation, rule 1's
// dual GLB+USDZ output, <model-viewer> for web, rule 7/8's AR launch), so
// the mockup's own framing already matches Realify exactly.

const STEPS = [
  { num: "01", label: "Бүтээгдэхүүний зураг" },
  { num: "02", label: "AI дахин бүтээлт" },
  { num: "03", label: "Mesh оновчлол" },
  { num: "04", label: "Материал ба текстур" },
  { num: "05", label: "GLB + USDZ" },
  { num: "06", label: "Web 3D" },
  { num: "07", label: "WebAR" },
];

export function DesktopPipelineSection() {
  return (
    <section className="px-6 py-24 lg:px-16 lg:py-[140px]" style={{ background: "rgb(233, 231, 223)" }}>
      <div className="mx-auto max-w-[1400px]">
        <p
          className="uppercase"
          style={{ fontSize: "10px", fontWeight: 400, color: "rgb(174, 177, 165)", letterSpacing: "1.5px", marginBottom: "20px" }}
        >
          3D-ийн үйлдлийн систем
        </p>
        <h2
          className="text-balance"
          style={{
            fontSize: "clamp(2.2rem, 4.95vw, 5.9375rem)",
            fontWeight: 650,
            lineHeight: 0.91,
            letterSpacing: "-0.075em",
            color: "rgb(21, 22, 18)",
            marginBottom: "64px",
          }}
        >
          Бэлэн бүтээгдэхүүнд зориулсан.
          <br />
          <em className="not-italic" style={{ color: "rgb(203, 208, 191)", fontWeight: 450 }}>
            Зөвхөн прототип биш.
          </em>
        </h2>

        <div>
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="grid grid-cols-[3rem_auto_1fr] items-center gap-4 py-[22px]"
              style={{ borderBottom: "1px solid rgb(184, 184, 174)" }}
            >
              <span style={{ fontSize: "10px", fontWeight: 400, color: "rgb(114, 116, 107)" }}>{step.num}</span>
              <b
                className="uppercase not-italic"
                style={{ fontSize: "15px", fontWeight: 550, color: "rgb(21, 22, 18)", letterSpacing: "1.35px" }}
              >
                {step.label}
              </b>
              <i
                aria-hidden="true"
                className="not-italic"
                style={{ borderBottom: "1px dashed rgb(184, 184, 174)" }}
              />
            </div>
          ))}
        </div>

        <p className="mt-10" style={{ fontSize: "13px", fontWeight: 400, color: "rgb(102, 104, 95)" }}>
          Ухаалаг дахин бүтээлт — бодит ертөнцийн хөтөч, гар утас бүрт тохирсон.
        </p>
      </div>
    </section>
  );
}
