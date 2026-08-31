import { DesktopMockupObject } from "@/components/DesktopMockupObject";

/**
 * "Realify гэж юу вэ" — 1:1 clone of the mockup's `.intro` section: kicker
 * + headline + lead paragraph, the transform-strip (photo icon -> arrow ->
 * live 3D render — same mockup Three.js render as the hero, idle-sway
 * mode, matching the mockup's own `mountMiniModel('introCanvas', ...)`),
 * then the problem/solution pair. Dark — the mockup never gives this
 * section its own background, so it just inherits the page's
 * --color-landing-bg the same way the mockup's `.intro` does.
 */
export function DesktopIntroSection() {
  return (
    <section className="border-t border-landing-border px-6 py-24 lg:px-12">
      <div className="mx-auto flex w-full max-w-feed flex-col gap-10">
        <div className="flex flex-col gap-4">
          <p className="text-small font-bold uppercase tracking-wide text-landing-accent">
            Realify гэж юу вэ
          </p>
          <h2 className="max-w-lg text-heading font-extrabold text-landing-text text-balance">
            Зургаас — бодит зүйл рүү.
          </h2>
          <p className="max-w-2xl text-body text-landing-text-muted">
            Realify бол ямар ч зургийг секундын дотор AR-д бэлэн, бодит хэмжээтэй 3D загвар
            болгодог AI хэрэгсэл.
          </p>
        </div>

        <div className="flex items-center justify-center gap-7 rounded-card border border-landing-border-glass bg-landing-surface px-5 py-9">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-16 items-center justify-center rounded-card border border-landing-border-glass bg-landing-surface-2 text-landing-text-faint">
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                stroke="currentColor"
                fill="none"
                strokeWidth={1.5}
              >
                <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </div>
            <span className="text-small font-bold uppercase tracking-wide text-landing-text-faint">
              Нэг зураг
            </span>
          </div>
          <svg
            viewBox="0 0 24 24"
            className="size-6 shrink-0 text-landing-accent"
            stroke="currentColor"
            fill="none"
            strokeWidth={1.8}
          >
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
          <div className="flex flex-col items-center gap-3">
            <div className="size-16 overflow-hidden rounded-card border border-landing-border-glass bg-landing-surface-2">
              <DesktopMockupObject
                objUrl="/icons/mockup/chair.obj"
                textureUrl="/icons/mockup/chair_diffuse.png"
                metalness={0.3}
                roughness={0.42}
                mode="sway"
                cameraY={0.45}
                cameraZ={5.4}
                className="size-full"
              />
            </div>
            <span className="text-small font-bold uppercase tracking-wide text-landing-text-faint">
              Бодит 3D / AR
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-landing-border bg-landing-border lg:grid-cols-2">
          <div className="flex flex-col gap-3.5 bg-landing-bg p-7">
            <span
              className="w-fit rounded-full px-3 py-1.5 text-small font-bold uppercase tracking-wide"
              style={{ color: "#c98a6a", background: "rgb(201 138 106 / 0.1)" }}
            >
              Асуудал
            </span>
            <h3 className="max-w-md text-body font-bold text-landing-text">
              Онлайн зураг хэзээ ч бодит байдлыг мэдрүүлдэггүй.
            </h3>
            <p className="max-w-md text-small text-landing-text-muted">
              Хэмжээ, хэлбэр, өнгө орон зайд яг хэрхэн харагдахыг тааж чадахгүй тул худалдан
              авагч эргэлзэж, буцаалт олширч, худалдагч итгэл алддаг.
            </p>
          </div>

          <div className="flex flex-col gap-3.5 bg-landing-surface p-7">
            <span className="w-fit rounded-full bg-landing-accent-soft px-3 py-1.5 text-small font-bold uppercase tracking-wide text-landing-accent">
              Шийдэл
            </span>
            <h3 className="max-w-md text-body font-bold text-landing-text">
              Realify танд өөрийн орчинд шууд харах боломж өгдөг.
            </h3>
            <p className="max-w-md text-small text-landing-text-muted">
              Нэг зургаас AI 3D загвар үүсгээд, AR-аар өрөөндөө шууд байрлуулж, худалдаж
              авахаасаа өмнө итгэлтэй шийдвэр гаргана.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
