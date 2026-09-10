"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Share2,
  Ruler,
  Image as ImageIcon,
  Download,
  QrCode,
  Box,
} from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { ModelScaleControl } from "@/components/ModelScaleControl";
import { ModelShare } from "@/components/ModelShare";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useModelScale } from "@/hooks/useModelScale";
import { buildModelUrl, formatDimensionsCm } from "@/lib/models";
import { deleteModel } from "@/lib/deleteModel";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";
import type { ARViewerHandle } from "@/components/ARViewer";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

// Rule 11 — ssr:false keeps @google/model-viewer's customElements.define()
// out of the SSR pass entirely (it needs `window`, which doesn't exist
// there). ResultStep.tsx (components/CaptureFlow.tsx's own review step)
// imports ARViewer the same way — see that rule's comment in ARViewer.tsx.
const ARViewer = dynamic(
  () => import("@/components/ARViewer").then((m) => m.ARViewer),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex aspect-[4/5] w-full items-center justify-center"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, var(--color-surface-hover), var(--color-bg) 75%)",
        }}
      >
        <Spinner size="lg" label="Ачаалж байна" />
      </div>
    ),
  },
);

// design/02-detail.png. No app-name header (decision 3) — just back + share.
// The secondary actions (scale, original photo, download-as-GLB,
// download-as-USDZ — download is split into two rather than one ambiguous
// button, since GLB and USDZ serve different people: GLB for anything
// generic, USDZ for someone specifically after their own iOS AR) are each
// their own free-floating "liquid glass" pill (2026-09-10 redesign, direct
// request) rather than one shared card containing plain icons — every pill
// carries its own frosted-glass material (backdrop-blur-xl +
// backdrop-saturate-150, a translucent fill, a bright rim highlight along
// its top edge via --shadow-liquid-glass) instead of the flatter, no-blur
// --shadow-glass-card treatment used elsewhere in the app (ModelCard.tsx/
// BuyCredits.tsx) — visually distinct on purpose, not a drop-in reuse of
// that language. The AR button is still the one high-contrast, full-width,
// bottom-docked, solid (not glass) element — Tripo's reference product
// treats AR as one of five equal icons, and that's exactly what this page
// must not do, since AR is the entire point of this product.
const ACTION_BUTTON_CLASS =
  "flex flex-col items-center gap-2 rounded-2xl border border-glass-border bg-glow-soft px-4 py-3 text-text-muted shadow-liquid-glass backdrop-blur-xl backdrop-saturate-150 transition-all duration-200 active:scale-95 hover:border-glass-border-hover hover:bg-glow-strong hover:text-text";

export function ModelDetail({
  initialModel,
  hasSession = true,
  isOwner = true,
}: {
  initialModel: ModelRow;
  /** Defaults true — every pre-existing caller is inside the auth-gated (app) group. */
  hasSession?: boolean;
  /** Gates download and scale persistence — see hooks/useModelScale.ts. */
  isOwner?: boolean;
}) {
  // Rule 14 — no polling. This is the one place the row's status/glb_url/
  // usdz_url ever change after the initial server-rendered fetch.
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;
  const [scale, setScale] = useModelScale(model.id, model.scale, isOwner);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const arViewerRef = useRef<ARViewerHandle>(null);
  const router = useRouter();

  // Available regardless of status (rule from the task: "every model needs
  // a way to remove it") — the row won't exist for this page to render
  // again after success, so this navigates away rather than updating local
  // state the way the feed's card-level delete does.
  async function handleDelete() {
    setDeleting(true);
    if (await deleteModel(model.id)) {
      router.push(hasSession ? "/dashboard" : "/");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "3D model", url });
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  const ready = model.status === "ready" && model.glb_url && model.usdz_url;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Capped/centered to match the content pane below it (lg:max-w-feed,
          same token HomeFeed.tsx uses) rather than staying edge-to-edge —
          at mobile width this is identical to before (max-w-feed is far
          wider than any phone viewport, so it never actually constrains
          anything there). */}
      <div className="flex h-12 shrink-0 items-center justify-between px-4 lg:mx-auto lg:w-full lg:max-w-feed lg:px-6">
        {/* Signed-out visitor has no /dashboard to go back to (it's still
            auth-gated) — send them to the landing page instead of a dead
            redirect-to-/login link. */}
        <Link
          href={hasSession ? "/dashboard" : "/"}
          aria-label="Буцах"
          className="text-text-muted transition-transform active:scale-90 hover:text-text"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <button
          type="button"
          onClick={handleShare}
          aria-label="Хуваалцах"
          className="text-text-muted transition-transform active:scale-90 hover:text-text"
        >
          <Share2 className="size-5" />
        </button>
      </div>

      {model.status === "failed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-body text-text">Үүсгэлт амжилтгүй боллоо.</p>
          {model.error && (
            <p className="text-small text-text-muted">{model.error}</p>
          )}
          {isOwner && (
            <DeleteAction
              deleting={deleting}
              onDelete={handleDelete}
              className="mt-4"
            />
          )}
        </div>
      ) : !ready ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <Spinner size="lg" label="Model үүсгэж байна" />
          <p className="text-small text-text-muted">
            Таны model үүсгэгдэж байна — ихэвчлэн 30-100 секунд шаардагдана.
          </p>
          {isOwner && (
            <DeleteAction
              deleting={deleting}
              onDelete={handleDelete}
              className="mt-4"
            />
          )}
        </div>
      ) : (
        // Two-pane at lg+ (2026-08-29): a big model-viewer pane (flex-1 —
        // the dominant one, per this file's own header comment on why AR
        // must never read as "one icon among several") beside a fixed-width
        // (w-96, Tailwind's own scale — not an invented value) info column
        // that just keeps every mobile section stacked exactly as it was.
        // Below lg this is still a single flex-col, identical to before.
        <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-feed lg:flex-row lg:items-start lg:gap-10 lg:px-6 lg:pt-6">
          {/* ARViewer returns model-viewer inside its own `relative` wrapper
              div (for the loading-spinner overlay) — that div, not
              model-viewer itself, is the actual flex item in this row, so
              lg:flex-1 has to live on ONE MORE wrapper around the whole
              component, not on the className prop that only ever reaches
              model-viewer. Without this, the relative div has no explicit
              width of its own; as a flex item its default sizing is
              shrink-to-content, and model-viewer's own w-full then has
              nothing real to resolve 100% against — a collapsed 0×0 box
              (caught live: model-viewer rendered with computed
              width/height "0px"), not a proportions problem. */}
          <div className="w-full lg:flex-1">
            {/* aspect-[4/5] (portrait, tuned for a phone screen) forced
                height = width * 1.25 — fine when width is a phone's own
                width, but at lg+ this pane is far wider than that, so the
                same ratio demanded a box taller than the actual viewport
                (the app shell is `fixed inset-0`, nothing scrolls to reveal
                the rest) and the model ran off the top/bottom edge.
                lg:h-detail-viewer caps the box to the real remaining
                viewport height instead (styles/tokens.css), so model-
                viewer's own auto-fit camera can frame the whole object at
                any screen size. */}
            <ARViewer
              ref={arViewerRef}
              glbKey={model.glb_url as string}
              usdzKey={model.usdz_url as string}
              alt="3D model"
              className="aspect-[4/5]! h-auto! w-full lg:aspect-auto! lg:h-detail-viewer! lg:rounded-card! lg:overflow-hidden!"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4 lg:w-96 lg:flex-none lg:gap-5 lg:px-0 lg:pt-0">
            {formatDimensionsCm(model) && (
              <span className="inline-flex w-fit items-center rounded-full border border-glass-border bg-glow-soft px-4 py-2 text-small uppercase tracking-wide text-text-muted shadow-liquid-glass backdrop-blur-xl backdrop-saturate-150">
                {formatDimensionsCm(model)}
              </span>
            )}

            {/* Each action its own free-floating liquid-glass pill (direct
                request) rather than one shared card — flex-wrap so 5 pills
                (owner view) still reflow cleanly at narrow widths instead
                of overflowing or shrinking illegibly. */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Not owner-gated — the URL being shared is the current page's
                own, already visible to whoever's looking at this button. */}
              <button
                type="button"
                onClick={() => setShareOpen((open) => !open)}
                aria-expanded={shareOpen}
                className={ACTION_BUTTON_CLASS}
              >
                <QrCode className="size-5" />
                <span className="text-small uppercase tracking-wide">
                  Хуваалцах
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScaleOpen((open) => !open)}
                aria-expanded={scaleOpen}
                className={ACTION_BUTTON_CLASS}
              >
                <Ruler className="size-5" />
                <span className="text-small uppercase tracking-wide">
                  Хэмжээ
                </span>
              </button>
              {/* Original photo and both downloads are owner-only: the source
                photo lives in the private `uploads` bucket behind its own
                ownership check (app/api/uploads/[...key]/route.ts), so for
                anyone but the owner this link would already 404/401 — hiding
                it isn't a new restriction, it's not showing a link that was
                already broken for this viewer. GLB/USDZ do serve from the
                public models bucket (rule 6) and would technically work for
                any viewer, but the download affordance itself is scoped to
                the owner as a deliberate product choice, not a data-access
                one. */}
              {isOwner && (
                <>
                  {/* Toggles an inline preview (below the AR button, direct
                      request) instead of opening a new tab — same pattern
                      as the Хуваалцах/Хэмжээ pills. */}
                  <button
                    type="button"
                    onClick={() => setPhotoOpen((open) => !open)}
                    aria-expanded={photoOpen}
                    className={ACTION_BUTTON_CLASS}
                  >
                    <ImageIcon className="size-5" />
                    <span className="text-small uppercase tracking-wide">
                      Эх зураг
                    </span>
                  </button>
                  <a
                    href={buildModelUrl(model.glb_url as string)}
                    download
                    className={ACTION_BUTTON_CLASS}
                  >
                    <Download className="size-5" />
                    <span className="text-small uppercase tracking-wide">
                      GLB
                    </span>
                  </a>
                  <a
                    href={buildModelUrl(model.usdz_url as string)}
                    download
                    className={ACTION_BUTTON_CLASS}
                  >
                    <Download className="size-5" />
                    <span className="text-small uppercase tracking-wide">
                      USDZ
                    </span>
                  </a>
                </>
              )}
            </div>

            {shareOpen && <ModelShare />}

            {scaleOpen && (
              <div className="rounded-2xl border border-glass-border bg-glow-soft p-4 shadow-liquid-glass backdrop-blur-xl backdrop-saturate-150">
                <ModelScaleControl scale={scale} onScaleChange={setScale} />
              </div>
            )}

            {/* Quiet, deliberately separate from the card above (rule 40's
              "no red anywhere" convention — same muted register as
              everything else, destructiveness conveyed by the confirm
              prompt and a little breathing room, not by color). */}
            {isOwner && (
              <div className="flex justify-center lg:justify-start">
                <DeleteAction deleting={deleting} onDelete={handleDelete} />
              </div>
            )}

            <div className="relative mt-auto flex flex-col gap-2 pb-4 pt-2 lg:pt-6">
              {/* Breathing glow behind the AR CTA (2026-08-29, glow/glass
                  redesign) — same animate-breathe + radial-ellipse idiom as
                  ARViewer.tsx's own presence ring, reused here rather than a
                  new pattern, just now framing the button that actually
                  launches AR instead of the viewer stage. Sized bigger than
                  the button on every side (button is h-14/w-full solid
                  white — a same-size glow sits almost entirely hidden
                  behind it, confirmed live: only a sliver of blur escaped
                  past the opaque edges) so the blur has real empty space to
                  bloom into and actually reads as a halo. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-4 -top-4 h-24 animate-breathe rounded-full opacity-40 blur-2xl lg:-top-2"
                style={{
                  background:
                    "radial-gradient(ellipse at center, var(--color-glow-strong) 0%, transparent 70%)",
                }}
              />
              <button
                type="button"
                onClick={() => arViewerRef.current?.activateAR()}
                className="relative flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-body font-semibold uppercase tracking-wide text-accent-text shadow-card transition-all duration-150 active:scale-[0.98] hover:bg-accent-hover hover:shadow-md"
              >
                <Box className="size-5" />
                Өрөөндөө байрлуулах
              </button>
            </div>

            {/* Эх зураг inline preview (direct request) — sits below the AR
                button rather than opening a new tab. Capped height +
                object-contain so an arbitrary-resolution source photo never
                blows out the column's width; bg-bg fills any letterboxing
                so a non-full-bleed photo still reads as sitting in a frame,
                not on a mismatched background. */}
            {isOwner && photoOpen && (
              <div className="overflow-hidden rounded-2xl border border-glass-border bg-glow-soft shadow-liquid-glass backdrop-blur-xl backdrop-saturate-150">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, per-user uploads bucket route, not a static/optimizable asset */}
                <img
                  src={`/api/uploads/${model.source_image_key}`}
                  alt="Эх зураг"
                  className="max-h-72 w-full bg-bg object-contain"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteAction({
  deleting,
  onDelete,
  className,
}: {
  deleting: boolean;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={deleting}
      className={cn(
        "text-small uppercase tracking-wide text-text-muted underline underline-offset-2 transition-transform active:scale-95 hover:text-text disabled:opacity-50",
        className,
      )}
    >
      {deleting ? "Устгаж байна…" : "Model устгах"}
    </button>
  );
}
