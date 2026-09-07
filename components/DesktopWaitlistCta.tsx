"use client";

// The real destination behind every "Chrome-д нэмэх" button on the landing
// page. The Chrome Web Store listing isn't published yet (Mongolia isn't a
// supported country for Google's developer-registration payment — a
// separate, unresolved blocker), so this can't literally install anything.
// Rather than a dead link, it opens a real "join the waitlist" form —
// app/api/waitlist/route.ts + migration 0025 back it with an actual table,
// not a decorative dead end. One component, reused by nav/hero/(later)
// final-CTA — className/style are passed through so each call site keeps
// its own exact button chrome; this component owns only the dialog + form.
//
// Native <dialog> (like components/ui/Dialog.tsx elsewhere in the app) for
// free focus-trap/Escape-to-close — styled with the landing page's own
// hardcoded dark palette instead of that component's design tokens, since
// Desktop*.tsx is intentionally token-exempt (see file header comments
// throughout components/Desktop*.tsx).

import { useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Check } from "lucide-react";

export interface DesktopWaitlistCtaProps {
  /** Which CTA instance this is (nav/hero/...) — stored on the row so signups are distinguishable later. */
  source: string;
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}

type Status = "idle" | "loading" | "done" | "error";

export function DesktopWaitlistCta({ source, className, style, children }: DesktopWaitlistCtaProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function open() {
    setStatus("idle");
    dialogRef.current?.showModal();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button type="button" onClick={open} className={className} style={style}>
        {children ?? (
          <>
            Chrome-д нэмэх
            <ArrowUpRight className="size-3.5" />
          </>
        )}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setStatus("idle")}
        className="backdrop:bg-black/60"
        style={{
          // Tailwind's preflight reset zeroes out <dialog>'s native
          // UA-stylesheet `margin: auto` centering — explicit fixed
          // top/left/translate replaces it rather than fighting preflight.
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          margin: 0,
          background: "rgb(20, 21, 17)",
          color: "rgb(240, 240, 235)",
          border: "1px solid rgb(255 255 255 / 0.12)",
          borderRadius: "16px",
          padding: 0,
          maxWidth: "380px",
          width: "calc(100vw - 48px)",
        }}
      >
        {status === "done" ? (
          <div style={{ padding: "32px 28px" }}>
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: "40px", height: "40px", background: "rgb(223, 227, 210)", color: "rgb(20, 21, 17)" }}
            >
              <Check className="size-5" />
            </div>
            <p style={{ marginTop: "16px", fontSize: "16px", fontWeight: 600 }}>Баярлалаа!</p>
            <p style={{ marginTop: "4px", fontSize: "13px", color: "rgb(174, 177, 165)" }}>
              Chrome Web Store-д нийтлэгдэх үед хамгийн эхэнд мэдэгдэл илгээнэ.
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="hover:opacity-80"
              style={{ marginTop: "20px", fontSize: "12px", fontWeight: 600, color: "rgb(240, 240, 235)" }}
            >
              Хаах
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: "28px" }}>
            <p
              className="uppercase"
              style={{ fontSize: "10px", fontWeight: 400, letterSpacing: "1.5px", color: "rgb(174, 177, 165)" }}
            >
              Тун удахгүй
            </p>
            <h3 style={{ marginTop: "8px", fontSize: "19px", fontWeight: 650, lineHeight: 1.2 }}>
              Chrome Web Store-д нийтлэгдэх дөхөж байна
            </h3>
            <p style={{ marginTop: "8px", fontSize: "13px", lineHeight: "19px", color: "rgb(174, 177, 165)" }}>
              Хамгийн эхэнд мэдэгдэл авахыг хүсвэл имэйлээ үлдээгээрэй.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="имэйл@жишээ.mn"
              className="w-full"
              style={{
                marginTop: "16px",
                background: "rgb(30, 31, 27)",
                border: "1px solid rgb(255 255 255 / 0.14)",
                borderRadius: "8px",
                padding: "11px 14px",
                fontSize: "14px",
                color: "rgb(240, 240, 235)",
              }}
            />
            {status === "error" && (
              <p style={{ marginTop: "8px", fontSize: "12px", color: "rgb(224, 122, 95)" }}>
                Алдаа гарлаа, дахин оролдоно уу.
              </p>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full hover:opacity-90 disabled:opacity-60"
              style={{
                marginTop: "16px",
                background: "rgb(238, 238, 233)",
                color: "rgb(17, 17, 17)",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.3px",
                padding: "13px",
                borderRadius: "8px",
              }}
            >
              {status === "loading" ? "Илгээж байна…" : "Мэдэгдэл авах"}
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="w-full text-center hover:opacity-80"
              style={{ marginTop: "12px", fontSize: "12px", color: "rgb(174, 177, 165)" }}
            >
              Болих
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
