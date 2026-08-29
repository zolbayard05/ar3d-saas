import { createClient } from "@/lib/supabase/server";
import { DesktopQrCard } from "@/components/DesktopQrCard";
import { DesktopLandingViewerLoader as DesktopLandingViewer } from "@/components/DesktopLandingViewerLoader";

/**
 * Desktop's entire experience (app/page.tsx branches here for any non-mobile
 * UA — see lib/isMobileUserAgent.ts). AR only works on a phone (rule 9/10),
 * so there's nothing functional to offer a desktop visitor; this is
 * marketing-only, one viewport-tall hero, no deep scroll needed to see the
 * point (2026 3D-landing research: "the main animation should be placed
 * right in the hero section so visitors see it immediately, no scrolling
 * required").
 *
 * Same query app/(app)/dashboard/page.tsx already runs (is_showcase=true,
 * ready) — the most recent showcase row is the hero; the next few become
 * the supporting strip. No new "is_hero" flag for now — a future
 * refinement, not required to ship this.
 */
export async function DesktopLanding() {
  const supabase = await createClient();
  const { data: models } = await supabase
    .from("models")
    .select("*")
    .eq("status", "ready")
    .eq("is_showcase", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const [hero, ...rest] = models ?? [];

  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      <div className="flex shrink-0 items-center gap-2 px-6 pt-6 lg:px-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="size-9 rounded-md" />
        <p className="text-heading font-semibold text-text">Realify</p>
      </div>

      <div className="mx-auto flex w-full max-w-feed flex-1 flex-col items-center justify-center gap-12 px-6 py-16 lg:flex-row lg:gap-20 lg:px-12">
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <h1 className="text-display font-semibold text-text text-balance">
            Зургаа өрөөндөө байрлуулж болох зүйл болгоорой.
          </h1>
          <p className="text-body text-text-muted">
            Realify нэг зурганаас бодит хэмжээтэй 3D model үүсгэдэг —
            дараа нь өөрийн утсаараа AR-аар өрөөндөө шууд байрлуулж
            үзнэ. Энэ туршлага зөвхөн утсан дээр л боломжтой тул QR
            кодыг уншуулаарай.
          </p>
          <DesktopQrCard />
        </div>

        <div className="w-full max-w-md lg:max-w-lg">
          {hero ? (
            <DesktopLandingViewer
              glbKey={hero.glb_url as string}
              alt={hero.title || undefined}
              className="aspect-square! h-auto! w-full rounded-card! overflow-hidden!"
            />
          ) : (
            <div className="aspect-square w-full rounded-card bg-surface-hover" />
          )}
        </div>
      </div>

      {rest.length > 0 && (
        <div className="mx-auto flex w-full max-w-feed flex-wrap justify-center gap-3 px-6 pb-16 lg:justify-start lg:px-12">
          {rest.map((model) => (
            <div
              key={model.id}
              className="size-24 overflow-hidden rounded-card border border-glass-border bg-surface-hover lg:size-28"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/uploads/${model.source_image_key}`}
                alt={model.title || ""}
                className="size-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
