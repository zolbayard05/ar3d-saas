// Settled after direct feedback that file-format/MB-size copy is developer
// jargon, not a customer benefit — speed, purchase confidence, and
// compatibility are what actually move a decision.
const BENEFITS = [
  {
    tag: "Хурд",
    head: "30–100 секундэд AI таны зургийг 3D болгоно.",
    body: "Дизайнер, тусгай тоног төхөөрөмж хэрэггүй — нэг зурган дээрээс шууд эхэлнэ.",
    big: true,
  },
  {
    tag: "Итгэлтэй сонголт",
    head: "Худалдаж авахаасаа өмнө яг тохирохыг мэднэ.",
    body: "AR-аар өрөөндөө байрлуулж үзээд эргэлзэлгүй шийднэ.",
  },
  {
    tag: "Хаана ч",
    head: "iPhone, Android — бүх утсан дээр шууд ажиллана.",
    body: "Апп татах шаардлагагүй, браузер дээрээ шууд нээгдэнэ.",
  },
];

/**
 * "Яагаад Realify" — 1:1 clone of the mockup's `.bento`: same light cream
 * body as the categories section above it (continuous, not a separate
 * break), a 2x2 "big" tile for the speed benefit, each tile getting a
 * soft accent-tinted glow in its top-right corner.
 */
export function DesktopBentoSection() {
  return (
    <section
      className="px-6 pb-32 pt-6 lg:px-12"
      style={{
        color: "var(--color-landing-ink)",
        background:
          "var(--color-landing-cream) radial-gradient(var(--color-landing-border-cream) 1px, transparent 1px) 0 0 / 22px 22px",
      }}
    >
      <div className="mx-auto flex w-full max-w-feed flex-col gap-14">
        <div className="flex max-w-2xl flex-col gap-3.5">
          <p className="text-small font-bold uppercase tracking-wide text-landing-accent">
            Яагаад Realify
          </p>
          <h2
            className="text-heading font-extrabold text-balance"
            style={{ color: "var(--color-landing-ink)" }}
          >
            Худалдан авалт биш, туршлага.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3" style={{ gridAutoRows: 170 }}>
          {BENEFITS.map((b) => (
            <div
              key={b.tag}
              className={`relative flex flex-col justify-between overflow-hidden bg-white p-6 ${
                b.big ? "lg:col-span-2 lg:row-span-2" : ""
              }`}
              style={{ borderRadius: 20, border: "1px solid var(--color-landing-border-cream)" }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  top: "-40%",
                  right: "-25%",
                  width: "75%",
                  height: "110%",
                  background: "radial-gradient(closest-side, rgb(204 106 60 / 0.22), transparent 70%)",
                }}
              />
              <span className="relative text-small font-semibold uppercase tracking-wide text-landing-accent">
                {b.tag}
              </span>
              <div>
                <p
                  className={`relative font-bold leading-tight ${b.big ? "text-heading" : "text-body"}`}
                  style={{ color: "var(--color-landing-ink)", maxWidth: b.big ? "22ch" : "22ch" }}
                >
                  {b.head}
                </p>
                <p
                  className="relative mt-2.5 text-small"
                  style={{ color: "var(--color-landing-ink-muted)", maxWidth: "32ch" }}
                >
                  {b.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
