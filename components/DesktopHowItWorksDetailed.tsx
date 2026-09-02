"use client";

import { useEffect, useRef, useState } from "react";
import { Puzzle, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneMock } from "@/components/PhoneMock";

type Flow = "mobile" | "extension";

interface StepDef {
  title: string;
  body: string;
  /** Path under public/how-it-works/ — drop a real screenshot there with
   *  this exact filename and it replaces the placeholder automatically,
   *  no code change needed. */
  image: string;
}

// First-pass content/copy only — meant to be refined once all screenshots
// exist (2026-09-01 product decision). Mobile screenshots are real phone
// captures (full status bar included), so they render inside PhoneMock's
// bezel/notch chrome (shared with DesktopProcessSection.tsx) rather than a
// plain box — that's what makes them read as "inside a phone" instead of a
// cropped rectangle. Extension screenshots are desktop popup/browser
// captures, which a phone bezel would misrepresent, so those render in a
// plain frame instead (see FRAME_BY_FLOW below).
const MOBILE_STEPS: StepDef[] = [
  {
    title: "Нэвтрэх",
    body: "Имэйл эсвэл Google-ээр хэдхэн секундэд нэвтэрнэ.",
    image: "/how-it-works/mobile-1.png",
  },
  {
    title: "Зураг сонгох",
    body: "Гар утаснаасаа шинэ зураг авах, эсвэл галерейгаас сонгоно.",
    image: "/how-it-works/mobile-2.png",
  },
  {
    title: "3D болгож байна",
    body: "AI таны зургийг 30–100 секундэд бодит хэмжээтэй 3D загвар болгоно.",
    image: "/how-it-works/mobile-3.png",
  },
  {
    title: "Загвар бэлэн боллоо",
    body: "Загвараа эргүүлж үзээд, таалагдвал хадгална.",
    image: "/how-it-works/mobile-4.png",
  },
  {
    title: "AR-аар үзэх",
    body: "Нэг товшилтоор өрөөндөө шууд бодитоор байрлуулж үзнэ.",
    image: "/how-it-works/mobile-5.png",
  },
];

const EXTENSION_STEPS: StepDef[] = [
  {
    title: "Extension суулгах",
    body: "Chrome Web Store-с нэг товшилтоор суулгана.",
    image: "/how-it-works/extension-1.png",
  },
  {
    title: "Зурган дээр right-click",
    body: "Онлайн дэлгүүрийн бүтээгдэхүүний зурган дээр хулганы баруун товч дараад “Realify — 3D болгох” сонго.",
    image: "/how-it-works/extension-2.png",
  },
  {
    title: "Баталгаажуулах",
    body: "Гарч ирсэн зургаа хараад “3D болгох” дар.",
    image: "/how-it-works/extension-3.png",
  },
  {
    title: "Боловсруулж байна",
    body: "30–100 секундийн дараа таны загвар бэлэн болно.",
    image: "/how-it-works/extension-4.png",
  },
  {
    title: "QR уншуулах",
    body: "Гарч ирсэн QR кодыг утасныхаа камераар уншуулаад шууд AR-аар үз.",
    image: "/how-it-works/extension-5.png",
  },
];

interface LightboxState {
  src: string;
  frame: "phone" | "plain";
}

export function DesktopHowItWorksDetailed() {
  const [flow, setFlow] = useState<Flow>("mobile");
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const steps = flow === "mobile" ? MOBILE_STEPS : EXTENSION_STEPS;

  return (
    <section className="border-t border-landing-border px-6 py-24 lg:px-12">
      <div className="mx-auto flex w-full max-w-feed flex-col gap-10">
        <div className="flex flex-col gap-3.5">
          <p className="text-small font-bold uppercase tracking-wide text-landing-accent">
            Дэлгэрэнгүй заавар
          </p>
          <h2 className="max-w-lg text-heading font-extrabold text-balance text-landing-text">
            Хэрхэн ашиглах вэ?
          </h2>
        </div>

        <div className="flex gap-1 self-start rounded-full border border-landing-border-glass bg-landing-surface p-1">
          <FlowTab active={flow === "mobile"} onClick={() => setFlow("mobile")}>
            <Smartphone className="size-4" />
            Гар утсан дээр
          </FlowTab>
          <FlowTab active={flow === "extension"} onClick={() => setFlow("extension")}>
            <Puzzle className="size-4" />
            Chrome өргөтгөл
          </FlowTab>
        </div>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, i) => (
            <StepCard
              key={`${flow}-${i}`}
              n={i + 1}
              frame={flow === "mobile" ? "phone" : "plain"}
              onOpen={(src, frame) => setLightbox({ src, frame })}
              {...step}
            />
          ))}
        </div>
      </div>

      <ImageLightbox lightbox={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}

/**
 * Click-to-enlarge for the step screenshots — desktop-only by construction,
 * not by a separate viewport check: this whole section only ever renders
 * inside DesktopLanding, which app/page.tsx branches to exclusively for
 * non-mobile UAs (mobile visitors get an entirely different splash and
 * never mount this component at all).
 */
function ImageLightbox({ lightbox, onClose }: { lightbox: LightboxState | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (lightbox && !node.open) node.showModal();
    if (!lightbox && node.open) node.close();
  }, [lightbox]);

  // Native <dialog> puts the ::backdrop outside the element's own box, so a
  // real backdrop click never lands "on" the dialog's children to check
  // against via a plain e.target === child guard — comparing the click
  // point to the dialog's own rendered rect (sized to the image, via CSS)
  // is what actually distinguishes "clicked the image" from "clicked
  // around it" regardless of how the dialog box itself is sized.
  function handleClick(event: React.MouseEvent<HTMLDialogElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={handleClick}
      className="m-auto max-h-lightbox max-w-lightbox overflow-visible rounded-lg bg-transparent p-0 backdrop:bg-black/85"
    >
      {lightbox && (
        <div className="relative">
          {lightbox.frame === "phone" ? (
            <PhoneMock variant="lightbox">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.src} alt="" className="size-full object-cover" />
            </PhoneMock>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.src}
              alt=""
              className="block max-h-lightbox max-w-lightbox rounded-lg object-contain"
            />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="absolute -top-3 -right-3 flex size-8 items-center justify-center rounded-full bg-landing-text text-landing-bg shadow-lg"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </dialog>
  );
}

function FlowTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-4 py-2 text-small font-semibold",
        active ? "bg-landing-text text-landing-bg" : "text-landing-text-faint hover:text-landing-text",
      )}
    >
      {children}
    </button>
  );
}

function StepCard({
  n,
  title,
  body,
  image,
  frame,
  onOpen,
}: {
  n: number;
  frame: "phone" | "plain";
  onOpen: (src: string, frame: "phone" | "plain") => void;
} & StepDef) {
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Server-rendered <img> starts loading the moment the browser parses the
  // HTML, which on a fast local server can 404 before React finishes
  // hydrating and attaches onError — that failure fires on the bare DOM
  // node with nothing listening yet and is otherwise lost, silently
  // leaving the browser's native broken-image icon on screen forever. This
  // effect runs once on mount and catches an already-failed image
  // (complete && naturalWidth === 0) in addition to onError below catching
  // any later failure (a real screenshot that 404s after hydration).
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth === 0) setErrored(true);
  }, []);

  // Phone screenshots are tight, already-phone-shaped captures (370x800,
  // close to PhoneMock's own bezel aspect) — object-cover crops only a
  // sliver. Extension screenshots are full desktop-window captures with
  // the popup sitting off-center (top-right, matching where Chrome
  // actually docks it under the toolbar icon) at a near-square aspect —
  // object-cover on those would crop into essentially random page content
  // depending on exactly where the popup happens to sit, so those get
  // object-contain instead: the whole capture always stays visible,
  // letterboxed rather than cropped.
  const shot = !errored ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={image}
      alt={title}
      className={cn("size-full", frame === "phone" ? "object-cover" : "object-contain")}
      onError={() => setErrored(true)}
    />
  ) : (
    <div className="flex size-full items-center justify-center p-4 text-center text-small text-landing-text-faint">
      Зураг удахгүй нэмэгдэнэ
    </div>
  );

  // Errored (placeholder) cards aren't clickable -- nothing to enlarge.
  const openButton = !errored ? (
    <button
      type="button"
      onClick={() => onOpen(image, frame)}
      aria-label={`${title} — томруулж харах`}
      className="size-full cursor-zoom-in"
    >
      {shot}
    </button>
  ) : (
    shot
  );

  return (
    <div className="flex flex-col gap-3">
      {frame === "phone" ? (
        <PhoneMock>{openButton}</PhoneMock>
      ) : (
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-landing-border-glass bg-landing-surface">
          {openButton}
        </div>
      )}
      <span className="text-small font-bold uppercase tracking-wide text-landing-accent">
        {String(n).padStart(2, "0")}
      </span>
      <h3 className="text-body font-bold text-landing-text">{title}</h3>
      <p className="text-small text-landing-text-muted">{body}</p>
    </div>
  );
}
