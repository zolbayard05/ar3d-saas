"use client";

// The hero's "object slot" for each beat, replacing a bare floating 3D
// object with a stylized browser window: product photo -> extension
// "activates" -> the real 3D object (passed in as children, unchanged from
// before) fades in. Dramatizes exactly what the extension actually does
// (right-click a product photo -> get a real 3D/AR preview) instead of
// just showing an object with no context for what "3D" is a transform OF.
//
// Owns only the chrome frame + the phase timer — the 3D content itself is
// whatever the caller already renders (DesktopMockupObject for the hero's
// chair beat, DesktopHeroModelViewer's real GLB + camera-controls for the
// sneaker/backpack beats), so neither of those keeps working exactly as
// before, drag-to-orbit included.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Puzzle } from "lucide-react";

export interface DesktopBrowserMockupProps {
  photoSrc: string;
  urlLabel: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

type Phase = "photo" | "activating" | "model";

const DURATIONS: Record<Phase, number> = { photo: 2200, activating: 900, model: 4200 };
const NEXT: Record<Phase, Phase> = { photo: "activating", activating: "model", model: "photo" };

export function DesktopBrowserMockup({ photoSrc, urlLabel, children, className, style }: DesktopBrowserMockupProps) {
  const [phase, setPhase] = useState<Phase>("photo");
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotionRef.current) {
      setPhase("model");
      return;
    }
    let timeoutId: ReturnType<typeof setTimeout>;
    function tick(current: Phase) {
      timeoutId = setTimeout(() => {
        const next = NEXT[current];
        setPhase(next);
        tick(next);
      }, DURATIONS[current]);
    }
    tick("photo");
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "14px",
        border: "1px solid rgb(255 255 255 / 0.1)",
        background: "rgb(15, 16, 14)",
        boxShadow: "0 30px 60px -20px rgb(0 0 0 / 0.6)",
        ...style,
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ padding: "10px 14px", borderBottom: "1px solid rgb(255 255 255 / 0.08)" }}
      >
        <div className="flex gap-[5px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="rounded-full" style={{ width: "7px", height: "7px", background: "rgb(255 255 255 / 0.16)" }} />
          ))}
        </div>
        <div
          className="flex-1 truncate rounded-full text-center"
          style={{ background: "rgb(255 255 255 / 0.06)", padding: "4px 10px", fontSize: "10px", color: "rgb(160, 162, 155)" }}
        >
          {urlLabel}
        </div>
        <div
          className="relative flex shrink-0 items-center justify-center rounded-md"
          style={{
            width: "22px",
            height: "22px",
            background: phase === "activating" ? "rgb(223, 227, 210)" : "rgb(255 255 255 / 0.08)",
            transition: "background 300ms",
          }}
        >
          <Puzzle
            className="size-3"
            style={{ color: phase === "activating" ? "rgb(20, 21, 17)" : "rgb(160, 162, 155)", transition: "color 300ms" }}
          />
          {phase === "activating" && (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-ping rounded-md"
              style={{ background: "rgb(223 227 210 / 0.45)" }}
            />
          )}
        </div>
      </div>

      <div className="relative" style={{ aspectRatio: "4 / 3" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed local /public asset inside a client component, no next/image benefit here */}
        <img
          src={photoSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover transition-opacity duration-500"
          style={{ opacity: phase === "model" ? 0 : 1 }}
        />

        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
          style={{ opacity: phase === "model" ? 1 : 0, pointerEvents: phase === "model" ? "auto" : "none" }}
        >
          {children}
        </div>

        {phase === "activating" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgb(0 0 0 / 0.35)" }}>
            <span
              className="uppercase"
              style={{
                fontSize: "9px",
                fontWeight: 500,
                letterSpacing: "1px",
                color: "rgb(240, 240, 235)",
                background: "rgb(20 21 17 / 0.85)",
                padding: "7px 12px",
                borderRadius: "9999px",
              }}
            >
              Realify3D: Бүтээгдэхүүн олдлоо
            </span>
          </div>
        )}

        {phase === "model" && (
          <a
            href="#ar"
            className="absolute hover:opacity-90"
            style={{
              right: "10px",
              bottom: "10px",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.2px",
              background: "rgb(238, 238, 233)",
              color: "rgb(17, 17, 17)",
              padding: "7px 11px",
              borderRadius: "9999px",
            }}
          >
            AR-аар үзэх
          </a>
        )}
      </div>
    </div>
  );
}
