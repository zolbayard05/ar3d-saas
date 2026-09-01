import { Camera } from "lucide-react";
import { DesktopMockupObject } from "@/components/DesktopMockupObject";
import { PhoneMock } from "@/components/PhoneMock";

interface DesktopProcessSectionProps {
  sourceImageSrc: string | null;
  title: string | null;
}

const CORNER_BORDER = "1.5px solid rgb(242 239 231 / 0.75)" as const;
const CORNERS: React.CSSProperties[] = [
  { top: 10, left: 10, borderTop: CORNER_BORDER, borderLeft: CORNER_BORDER },
  { top: 10, right: 10, borderTop: CORNER_BORDER, borderRight: CORNER_BORDER },
  { bottom: 10, left: 10, borderBottom: CORNER_BORDER, borderLeft: CORNER_BORDER },
  { bottom: 10, right: 10, borderBottom: CORNER_BORDER, borderRight: CORNER_BORDER },
];

/**
 * "Хэрхэн ажилладаг" — 1:1 clone of the mockup's `.process` section: three
 * real phone-frame mockups (not flat cards), each showing one real step of
 * the actual pipeline. Step 1 uses the real uploaded source photo (not a
 * fabricated stand-in), step 3 mounts the real model-viewer inside the
 * phone's "AR camera view" chrome instead of the mockup's static room
 * gradient + canvas. Every pixel value (phone radius, notch size, ring
 * geometry...) is copied straight from the mockup's own CSS rather than
 * re-derived against the app's own spacing scale, per the "yag adilhan"
 * (exactly identical) requirement — hence inline styles throughout instead
 * of token classes: this app's own `rounded-sm/md/lg` etc. resolve to this
 * *product's* radius tokens (styles/tokens.css), not the mockup's raw
 * pixel values, so reusing them here would silently drift from the mockup
 * the moment those tokens change.
 */
export function DesktopProcessSection({ sourceImageSrc, title }: DesktopProcessSectionProps) {
  return (
    <section className="border-t border-landing-border px-6 py-24 lg:px-12">
      <div className="mx-auto flex w-full max-w-feed flex-col gap-14">
        <div className="flex flex-col gap-3.5">
          <p className="text-small font-bold uppercase tracking-wide text-landing-accent">
            Хэрхэн ажилладаг
          </p>
          <h2 className="max-w-lg text-heading font-extrabold text-landing-text text-balance">
            Зургаас — 3D-ээр дамжаад — өрөөндөө.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          {/* Step 1 — upload */}
          <div className="flex flex-col items-start gap-4">
            <PhoneMock>
              <div className="flex h-full flex-col items-center p-3.5 pt-8">
                <p
                  className="mb-3.5 self-start font-bold uppercase"
                  style={{ color: "#8f8c82", fontSize: 9.5, letterSpacing: "0.06em" }}
                >
                  Зураг оруулах
                </p>
                <div
                  className="relative flex w-full flex-1 items-center justify-center overflow-hidden"
                  style={{
                    borderRadius: 16,
                    background: "linear-gradient(160deg,#232019,#141311)",
                    border: "1.5px dashed rgb(255 255 255 / 0.16)",
                  }}
                >
                  {sourceImageSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sourceImageSrc}
                      alt={title || ""}
                      className="size-full object-contain"
                    />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute h-0.5 animate-landing-scan rounded-full"
                    style={{
                      left: "6%",
                      right: "6%",
                      background:
                        "linear-gradient(90deg, transparent, var(--color-landing-accent), transparent)",
                    }}
                  />
                  <div
                    className="absolute flex items-center justify-center"
                    style={{
                      top: 10,
                      right: 10,
                      width: 22,
                      height: 22,
                      borderRadius: 8,
                      background: "rgb(0 0 0 / 0.5)",
                      border: "1px solid rgb(255 255 255 / 0.14)",
                    }}
                  >
                    <Camera size={12} color="#eceae4" strokeWidth={1.8} />
                  </div>
                </div>
                <div
                  className="mt-3 w-full p-2.5 text-center text-xs font-bold"
                  style={{ background: "#f2efe7", color: "#141311", borderRadius: 12 }}
                >
                  Үүсгэх →
                </div>
              </div>
            </PhoneMock>
            <ProcStepInfo n="01" title="Зургаа оруул" body="Нэг тод зураг л хэрэгтэй — дизайны мэдлэг шаардлагагүй." />
          </div>

          {/* Step 2 — generating */}
          <div className="flex flex-col items-start gap-4">
            <PhoneMock>
              <div className="flex h-full flex-col items-center justify-center" style={{ gap: 18 }}>
                <div
                  className="flex items-center text-xs font-extrabold"
                  style={{ color: "#c9c6ba", gap: 6, letterSpacing: "0.04em" }}
                >
                  <span className="rounded-full bg-landing-accent" style={{ width: 6, height: 6 }} />
                  REALIFY
                </div>
                <div className="relative" style={{ width: 96, height: 96 }}>
                  <svg viewBox="0 0 84 84" className="size-full -rotate-90">
                    <circle
                      cx="42"
                      cy="42"
                      r="39"
                      fill="none"
                      strokeWidth={5}
                      stroke="rgb(255 255 255 / 0.1)"
                    />
                    <circle
                      cx="42"
                      cy="42"
                      r="39"
                      fill="none"
                      strokeWidth={5}
                      strokeLinecap="round"
                      stroke="var(--color-landing-accent)"
                      strokeDasharray={245}
                      strokeDashoffset={64}
                      className="animate-landing-ringspin"
                    />
                  </svg>
                  <div
                    className="absolute inset-0 flex items-center justify-center text-base font-extrabold"
                    style={{ color: "#f2efe7" }}
                  >
                    74%
                  </div>
                </div>
                <p style={{ color: "#8f8c82", fontSize: 10, letterSpacing: "0.04em" }}>
                  3D болгож байна · 30–100 секунд
                </p>
              </div>
            </PhoneMock>
            <ProcStepInfo n="02" title="AI 3D болгоно" body="Бодит хэмжээтэй, текстуртай загвар автоматаар бэлэн болно." />
          </div>

          {/* Step 3 — AR camera view */}
          <div className="flex flex-col items-start gap-4">
            <PhoneMock>
              <div
                className="relative size-full"
                style={{
                  background:
                    "linear-gradient(180deg,#d7dbd1 0%,#b7bdad 40%,#8d9382 68%,#666c58 100%)",
                }}
              >
                <div
                  aria-hidden="true"
                  className="absolute"
                  style={{
                    top: "9%",
                    left: "9%",
                    width: "36%",
                    height: "24%",
                    borderRadius: 3,
                    background: "linear-gradient(160deg,#fff8e8,#ffe6ac)",
                    opacity: 0.8,
                    filter: "blur(.5px)",
                  }}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0"
                  style={{ top: "63%", height: 1, background: "rgb(20 20 15 / 0.14)" }}
                />
                <div className="absolute inset-0">
                  <DesktopMockupObject
                    objUrl="/icons/mockup/sofa.obj"
                    textureUrl="/icons/mockup/sofa_diffuse.png"
                    metalness={0.04}
                    roughness={0.82}
                    mode="sway"
                    cameraY={0.55}
                    cameraZ={4.9}
                    className="size-full"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 -translate-x-1/2 animate-landing-ringpulse"
                  style={{
                    bottom: "29%",
                    width: 64,
                    height: 20,
                    borderRadius: 9999,
                    border: "1.5px solid rgb(20 20 15 / 0.4)",
                    boxShadow: "0 0 0 5px rgb(20 20 15 / 0.06)",
                  }}
                />
                <span
                  className="absolute font-bold"
                  style={{
                    top: 12,
                    left: 12,
                    padding: "4px 9px",
                    borderRadius: 9999,
                    background: "rgb(20 18 12 / 0.55)",
                    color: "#f2efe7",
                    fontSize: 9.5,
                    letterSpacing: "0.06em",
                  }}
                >
                  AR
                </span>
                {CORNERS.map((cornerStyle, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="absolute"
                    style={{ width: 14, height: 14, ...cornerStyle }}
                  />
                ))}
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 -translate-x-1/2 rounded-full"
                  style={{
                    bottom: 12,
                    width: 38,
                    height: 38,
                    background: "rgb(242 239 231 / 0.92)",
                    boxShadow: "0 0 0 3px rgb(242 239 231 / 0.3)",
                  }}
                />
              </div>
            </PhoneMock>
            <ProcStepInfo
              n="03"
              title="Өрөөндөө байрлуул"
              body="Утсандаа нээгээд AR-аар шууд орчиндоо харна — энэ яг таны бодит загвар."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProcStepInfo({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <>
      <span className="text-small font-bold uppercase tracking-wide text-landing-accent">{n}</span>
      <h3 className="text-body font-bold text-landing-text">{title}</h3>
      <p className="text-small text-landing-text-muted" style={{ maxWidth: "32ch" }}>
        {body}
      </p>
    </>
  );
}
