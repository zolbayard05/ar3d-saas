"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Share2, Ruler, Image as ImageIcon, Download, QrCode, Box } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { ModelScaleControl } from "@/components/ModelScaleControl";
import { ModelShare } from "@/components/ModelShare";
import { useModelRealtime } from "@/hooks/useModelRealtime";
import { useModelScale } from "@/hooks/useModelScale";
import { useModelTitle } from "@/hooks/useModelTitle";
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
const ARViewer = dynamic(() => import("@/components/ARViewer").then((m) => m.ARViewer), {
  ssr: false,
  loading: () => (
    <div
      className="flex aspect-[4/5] w-full items-center justify-center"
      style={{
        background: "radial-gradient(circle at 50% 38%, var(--color-surface-hover), var(--color-bg) 75%)",
      }}
    >
      <Spinner size="lg" label="Ачаалж байна" />
    </div>
  ),
});

// design/02-detail.png. No app-name header (decision 3) — just back + share.
// The secondary actions (scale, original photo, download-as-GLB,
// download-as-USDZ — download is split into two rather than one ambiguous
// button, since GLB and USDZ serve different people: GLB for anything
// generic, USDZ for someone specifically after their own iOS AR) are
// icon+label only, muted, same visual register as everything else on the
// page; the AR button is the one high-contrast, full-width, bottom-docked
// element. That gap in weight is deliberate — Tripo's reference product
// treats AR as one of five equal icons, and that's exactly what this page
// must not do, since AR is the entire point of this product.
export function ModelDetail({
  initialModel,
  hasSession = true,
  isOwner = true,
}: {
  initialModel: ModelRow;
  /** Defaults true — every pre-existing caller is inside the auth-gated (app) group. */
  hasSession?: boolean;
  /** Gates title-edit/download and scale persistence — see hooks/useModelScale.ts. */
  isOwner?: boolean;
}) {
  // Rule 14 — no polling. This is the one place the row's status/glb_url/
  // usdz_url ever change after the initial server-rendered fetch.
  const model = useModelRealtime(initialModel.id, initialModel) ?? initialModel;
  const [scale, setScale] = useModelScale(model.id, model.scale, isOwner);
  const { title, setTitle, commitTitle } = useModelTitle(model.id, model.title);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
        await navigator.share({ title: title || "3D model", url });
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
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        {/* Signed-out visitor has no /dashboard to go back to (it's still
            auth-gated) — send them to the landing page instead of a dead
            redirect-to-/login link. */}
        <Link
          href={hasSession ? "/dashboard" : "/"}
          aria-label="Буцах"
          className="text-text-muted hover:text-text"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <button
          type="button"
          onClick={handleShare}
          aria-label="Хуваалцах"
          className="text-text-muted hover:text-text"
        >
          <Share2 className="size-5" />
        </button>
      </div>

      {model.status === "failed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-body text-text">Үүсгэлт амжилтгүй боллоо.</p>
          {model.error && <p className="text-small text-text-muted">{model.error}</p>}
          {isOwner && <DeleteAction deleting={deleting} onDelete={handleDelete} className="mt-4" />}
        </div>
      ) : !ready ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <Spinner size="lg" label="Model үүсгэж байна" />
          <p className="text-small text-text-muted">
            Таны model үүсгэгдэж байна — ихэвчлэн 30-100 секунд шаардагдана.
          </p>
          {isOwner && <DeleteAction deleting={deleting} onDelete={handleDelete} className="mt-4" />}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <ARViewer
            ref={arViewerRef}
            glbKey={model.glb_url as string}
            usdzKey={model.usdz_url as string}
            scale={scale}
            alt={title || undefined}
            className="aspect-[4/5]! h-auto! w-full"
          />

          <div className="flex flex-col gap-1 px-4 pt-4">
            {/* Editable in place for the owner only — title is one of the
                two columns `authenticated` may write directly (migration
                0004), but that grant is still row-scoped by RLS to
                auth.uid() = user_id, so a non-owner's write would silently
                affect zero rows. Showing an editable field that quietly
                does nothing is worse than not showing it, so a viewer who
                followed a shared link (migration 0011) or an authenticated
                non-owner both get plain text instead. No pencil-icon/
                edit-mode toggle for the owner case: it's just an input
                styled as the heading, committing on blur/Enter rather than
                per keystroke. */}
            {isOwner ? (
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={(event) => commitTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                placeholder="Нэргүй"
                className="bg-transparent text-heading font-semibold text-text placeholder:text-text-muted focus:outline-none"
              />
            ) : (
              <p className="text-heading font-semibold text-text">{title || "Нэргүй"}</p>
            )}
            {formatDimensionsCm(model) && (
              <p className="text-small uppercase tracking-wide text-text-muted">
                {formatDimensionsCm(model)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-around px-4 py-6">
            {/* Not owner-gated — the URL being shared is the current page's
                own, already visible to whoever's looking at this button. */}
            <button
              type="button"
              onClick={() => setShareOpen((open) => !open)}
              aria-expanded={shareOpen}
              className="flex flex-col items-center gap-2 text-text-muted hover:text-text"
            >
              <QrCode className="size-5" />
              <span className="text-small uppercase tracking-wide">Хуваалцах</span>
            </button>
            <button
              type="button"
              onClick={() => setScaleOpen((open) => !open)}
              aria-expanded={scaleOpen}
              className="flex flex-col items-center gap-2 text-text-muted hover:text-text"
            >
              <Ruler className="size-5" />
              <span className="text-small uppercase tracking-wide">Хэмжээ</span>
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
                <a
                  href={`/api/uploads/${model.source_image_key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 text-text-muted hover:text-text"
                >
                  <ImageIcon className="size-5" />
                  <span className="text-small uppercase tracking-wide">Эх зураг</span>
                </a>
                <a
                  href={buildModelUrl(model.glb_url as string)}
                  download
                  className="flex flex-col items-center gap-2 text-text-muted hover:text-text"
                >
                  <Download className="size-5" />
                  <span className="text-small uppercase tracking-wide">GLB</span>
                </a>
                <a
                  href={buildModelUrl(model.usdz_url as string)}
                  download
                  className="flex flex-col items-center gap-2 text-text-muted hover:text-text"
                >
                  <Download className="size-5" />
                  <span className="text-small uppercase tracking-wide">USDZ</span>
                </a>
              </>
            )}
          </div>

          {shareOpen && <ModelShare title={title} />}

          {scaleOpen && (
            <div className="px-4 pb-4">
              <ModelScaleControl scale={scale} onScaleChange={setScale} />
            </div>
          )}

          {/* Quiet, deliberately separate from the icon row above (rule 40's
              "no red anywhere" convention — same muted register as
              everything else, destructiveness conveyed by the confirm
              prompt and a little breathing room, not by color). */}
          {isOwner && (
            <div className="flex justify-center px-4 pb-2">
              <DeleteAction deleting={deleting} onDelete={handleDelete} />
            </div>
          )}

          {/* Bottom padding grows by --install-bar-reserve (InstallPrompt.tsx)
              whenever that fixed-position banner is actually showing — this
              screen has no scroll container of its own to carry that
              reserve the way HomeFeed/LibraryFeed do, so the AR button was
              sitting directly underneath the banner instead. 1rem matches
              the previous flat pb-4 baseline when no banner is up. */}
          <div
            className="mt-auto flex flex-col gap-2 px-4 pt-2"
            style={{ paddingBottom: "calc(1rem + var(--install-bar-reserve, 0px))" }}
          >
            <button
              type="button"
              onClick={() => arViewerRef.current?.activateAR()}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-body font-semibold uppercase tracking-wide text-accent-text shadow-card hover:bg-accent-hover"
            >
              <Box className="size-5" />
              Өрөөндөө байрлуулах
            </button>
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
        "text-small uppercase tracking-wide text-text-muted underline underline-offset-2 hover:text-text disabled:opacity-50",
        className,
      )}
    >
      {deleting ? "Устгаж байна…" : "Model устгах"}
    </button>
  );
}
