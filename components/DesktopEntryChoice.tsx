"use client";

import { useState } from "react";
import Link from "next/link";
import { Puzzle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { DesktopQrCard } from "@/components/DesktopQrCard";

type Mode = "mobile" | "desktop";

// Unset until the extension is actually published (it's an unpacked 0.1.0
// dev build today — see extension/manifest.json). One env var flip once
// it's live, same pattern as NEXT_PUBLIC_MODELS_CDN_URL going from "local
// proxy fallback" to a real custom domain.
const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || null;

/**
 * Replaces the old single QR-only CTA with an explicit choice: most
 * visitors want to try AR on their phone (QR stays the default tab), but a
 * visitor who already knows they want the Chrome extension (right-click a
 * product photo anywhere on the web -> 3D) gets a real, discoverable path
 * to it instead of needing to already know the /settings URL. Deliberately
 * NOT a blanket "unlock the full desktop app" escape hatch (an earlier,
 * reverted version of this was exactly that) — the desktop panel below
 * only ever points at /settings, which needs no cookie or gate change: it
 * was already exempt from lib/supabase/proxy.ts's device gate.
 */
export function DesktopEntryChoice() {
  const [mode, setMode] = useState<Mode>("mobile");

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <div className="flex gap-1 rounded-full border border-glass-border bg-surface-hover p-1">
        <TabButton active={mode === "mobile"} onClick={() => setMode("mobile")}>
          <Smartphone className="size-4" />
          Гар утсан дээр
        </TabButton>
        <TabButton active={mode === "desktop"} onClick={() => setMode("desktop")}>
          <Puzzle className="size-4" />
          Chrome өргөтгөл
        </TabButton>
      </div>

      {mode === "mobile" ? <DesktopQrCard /> : <DesktopExtensionSteps />}
    </div>
  );
}

function TabButton({
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

function DesktopExtensionSteps() {
  return (
    <div className="flex w-full flex-col gap-4 rounded-card border border-glass-border bg-surface-hover p-6 shadow-glass-card">
      <Step n={1} title="Chrome-д нэмэх">
        {CHROME_STORE_URL ? (
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-small font-semibold text-landing-accent underline underline-offset-4"
          >
            Chrome Web Store-с нэмэх →
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-landing-accent-soft px-2.5 py-1 text-small font-semibold text-landing-accent">
            Тун удахгүй Web Store-д нийтлэгдэнэ
          </span>
        )}
      </Step>
      <Step n={2} title="Токеноо холбох">
        <Link
          href="/settings"
          className="text-small text-landing-text-faint underline underline-offset-4 hover:text-landing-text"
        >
          Нэвтэрч, Тохиргоо хэсгээс токеноо үүсгэ →
        </Link>
      </Step>
      <Step n={3} title="Ямар ч зурган дээр ашиглах">
        <p className="text-small text-landing-text-faint">
          Онлайн дэлгүүрийн бүтээгдэхүүний зурган дээр хулганы баруун товч дараад “3D болгох” сонго.
        </p>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-landing-accent-soft text-small font-bold text-landing-accent">
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-small font-semibold text-landing-text">{title}</p>
        {children}
      </div>
    </div>
  );
}
