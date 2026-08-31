const CATEGORIES: { n: string; name: string; path: string }[] = [
  {
    n: "01",
    name: "Тавилга",
    path: "M5 12V9a2 2 0 012-2h10a2 2 0 012 2v3|M5 12v6a2 2 0 002 2h1M19 12v6a2 2 0 01-2 2h-1|M5 12h14|M8 20v-2M16 20v-2",
  },
  {
    n: "02",
    name: "Гэр ахуйн эд зүйл",
    path: "M3 7l9-4 9 4-9 4-9-4z|M3 7v10l9 4 9-4V7|M12 11v10",
  },
  { n: "03", name: "Гэрэлтүүлэг", path: "M9.5 21h5M10 17.5h4M12 14v3" },
  {
    n: "04",
    name: "Тоглоом, дурсгал зүйл",
    path: "M12 3l2.4 5.3L20 9l-4.3 3.9 1 5.8L12 15.9l-4.7 2.8 1-5.8L4 9l5.6-.7L12 3z",
  },
  {
    n: "05",
    name: "Урлагийн зүйл",
    path: "M12 3a9 9 0 100 18c1 0 1.6-.5 1.6-1.4 0-.4-.2-.7-.4-1a1.7 1.7 0 011.3-2.8H16a4 4 0 004-4c0-5-3.6-8.8-8-8.8z",
  },
  { n: "06", name: "Цахилгаан хэрэгсэл", path: "M13 2L4 14h6l-1 8 9-12h-6l1-8z" },
];

/**
 * "Юу үүсгэж болох вэ" — 1:1 clone of the mockup's `.categories`. The
 * page's first break from black: warm cream light section with a faint
 * dot-grid background, matching the mockup's own "dark hero -> light body
 * -> dark closing CTA" two-tone journey. Icon paths copied verbatim from
 * the mockup's inline SVGs (no lucide-react substitute reads identically).
 */
export function DesktopCategoriesSection() {
  return (
    <section
      className="px-6 py-24 lg:px-12"
      style={{
        color: "var(--color-landing-ink)",
        background:
          "var(--color-landing-cream) radial-gradient(var(--color-landing-border-cream) 1px, transparent 1px) 0 0 / 22px 22px",
      }}
    >
      <div className="mx-auto flex w-full max-w-feed flex-col gap-10">
        <div className="flex flex-col gap-3.5">
          <p className="text-small font-bold uppercase tracking-wide text-landing-accent">
            Юу үүсгэж болох вэ
          </p>
          <h2 className="max-w-2xl text-heading font-extrabold text-balance" style={{ color: "var(--color-landing-ink)" }}>
            Ямар ч эд зүйлийн нэг зургаас — AR-д бэлэн 3D загвар.
          </h2>
        </div>

        <div
          className="grid grid-cols-2 gap-px overflow-hidden lg:grid-cols-3"
          style={{ borderRadius: 20, border: "1px solid var(--color-landing-border-cream)", background: "var(--color-landing-border-cream)" }}
        >
          {CATEGORIES.map(({ n, name, path }) => (
            <div
              key={n}
              className="flex flex-col justify-between bg-landing-cream transition-colors hover:bg-white"
              style={{ minHeight: 150, gap: 26, padding: "26px 22px" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex items-center justify-center"
                  style={{ width: 38, height: 38, borderRadius: 11, background: "#fff", border: "1px solid var(--color-landing-border-cream)" }}
                >
                  <svg viewBox="0 0 24 24" width={19} height={19} stroke="var(--color-landing-accent)" fill="none" strokeWidth={1.6}>
                    {n === "03" && <circle cx="12" cy="9" r="5" />}
                    {path.split("|").map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </svg>
                </span>
                <span className="text-small font-semibold" style={{ color: "var(--color-landing-ink-muted)" }}>
                  {n}
                </span>
              </div>
              <p className="text-heading font-extrabold" style={{ color: "var(--color-landing-ink)" }}>
                {name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
