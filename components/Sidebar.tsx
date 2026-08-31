"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Zap } from "lucide-react";
import { NAV_ITEMS } from "@/lib/navItems";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  hasActiveJob?: boolean;
  /** Signed-out visitor on the public /dashboard showcase has no credits to show — omit to hide the bottom credits row entirely. */
  userId?: string;
}

// Desktop-only (lg+) counterpart to BottomNav — a new breakpoint dimension
// added 2026-08-28, not a second *mobile* nav variant (rule 39 governs the
// mobile viewport; nothing about it anticipated a screen wide enough for a
// fixed rail). Exactly one of Sidebar/BottomNav renders at any given
// viewport width — each hides itself at the other's breakpoint. Same
// hide-on-model-detail behavior as BottomNav (that page hasn't had its own
// desktop layout pass yet, and the reasoning — a bottom-docked AR CTA that
// a nav would visually collide with — is content this page owns, not a
// mobile-only concern that stops applying here).
export function Sidebar({ hasActiveJob, userId }: SidebarProps) {
  const pathname = usePathname();
  // Hooks can't be called conditionally — useCredits(userId ?? "") with a
  // skip flag is the standard escape hatch, not a real fetch for "".
  const { credits, loading } = useCredits(userId ?? "");

  if (pathname?.startsWith("/models/")) return null;

  return (
    <nav className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col gap-1 border-r border-border-subtle bg-bg px-3 py-6 lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="size-9 rounded-md" />
        <p className="text-heading font-semibold text-text">Realify</p>
      </Link>

      {NAV_ITEMS.map(({ href, icon: Icon, label, key }) => {
        const active = pathname === href;
        const isCreate = key === "create";

        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-body hover:bg-surface-hover",
              active ? "text-text" : "text-text-muted",
            )}
          >
            <span className="relative flex">
              <Icon className="size-5" />
              {isCreate && hasActiveJob && (
                <span
                  className="absolute -right-0.5 -top-0.5 size-1.5 bg-text"
                  aria-hidden="true"
                />
              )}
            </span>
            {label}
          </Link>
        );
      })}

      {/* Bottom credits row (2026-08-29) — the rail read as sparse/empty
          with just 4 items in a full-height column (feedback: "хэт
          хоосон/уйтгартай"); this both fills that space with something
          real (not decorative filler) and gives credits/Buy-Credits a
          persistent, always-visible home on desktop the way the mobile
          Library header already has, instead of only surfacing there.
          userId is absent for a signed-out visitor on the public
          /dashboard showcase — nothing to show, so the row is omitted
          rather than rendering a meaningless "0 кредит". */}
      {userId && (
        <div className="mt-auto border-t border-border-subtle pt-4">
          <Link
            href="/credits"
            className="flex items-center justify-between rounded-md px-3 py-2.5 text-small text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <span className="flex items-center gap-2 uppercase tracking-wide">
              <Zap className="size-4" />
              {loading ? "…" : `${credits ?? 0} кредит`}
            </span>
            <span className="uppercase tracking-wide underline underline-offset-2">
              Нэмэх
            </span>
          </Link>
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className="mt-1 flex items-center gap-2 rounded-md px-3 py-2.5 text-small uppercase tracking-wide text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <Settings className="size-4" />
            Тохиргоо
          </Link>
        </div>
      )}
    </nav>
  );
}
