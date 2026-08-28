"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navItems";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  hasActiveJob?: boolean;
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
export function Sidebar({ hasActiveJob }: SidebarProps) {
  const pathname = usePathname();

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
                <span className="absolute -right-0.5 -top-0.5 size-1.5 bg-text" aria-hidden="true" />
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
