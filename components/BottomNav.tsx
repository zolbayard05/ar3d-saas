"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Plus, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomNavProps {
  /** Shows a badge dot on the create icon — an in-progress job exists. */
  hasActiveJob?: boolean;
}

// CLAUDE.md rules 39/40: three separate floating rounded-square buttons,
// not a merged bar, reused as-is on every screen — never a second variant.
const ITEMS = [
  { href: "/dashboard", icon: LayoutGrid, label: "Нүүр", key: "home" },
  { href: "/create", icon: Plus, label: "Үүсгэх", key: "create" },
  { href: "/library", icon: Columns2, label: "Миний Model", key: "library" },
] as const;

export function BottomNav({ hasActiveJob }: BottomNavProps) {
  const pathname = usePathname();

  // design/02-detail.png is edge-to-edge with a single bottom-docked AR CTA
  // in the nav's own screen position — a floating nav group stacked over
  // that button would reintroduce the equal-weight problem the detail view
  // is specifically designed to avoid.
  //
  // /create used to be hidden for the same reason (its own bottom-docked
  // shutter/Create buttons), but that meant there was no way back out of
  // the flow except finishing it — overridden 2026-08-24: the nav stays
  // visible there too now, and CaptureFlow.tsx reserves bottom clearance
  // (92px = this nav's own 24px offset + 56px height + 12px gap, same
  // figure InstallPrompt.tsx computes) once for whichever phase is
  // showing, so its bottom-docked buttons don't sit underneath it.
  if (pathname?.startsWith("/models/")) return null;

  return (
    // pointer-events-none on the row, -auto on each button: the row spans
    // the full viewport width (inset-x-0) so the feed stays scrollable/
    // clickable in the empty space either side of the centered group, per
    // rule 39 — "never full width, never touching an edge" describes the
    // visible buttons, not a full-width hit-target behind them.
    <nav
      className="pointer-events-none fixed inset-x-0 z-10 flex items-center justify-center gap-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
    >
      {ITEMS.map(({ href, icon: Icon, label, key }, i) => {
        const active = pathname === href;
        const isCreate = key === "create";

        return (
          <Link
            key={key + i}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="pointer-events-auto relative flex size-14 items-center justify-center rounded-lg bg-nav-fill"
          >
            <Icon className={cn("size-6", active ? "text-text" : "text-text-muted")} />
            {isCreate && hasActiveJob && (
              <span className="absolute right-2.5 top-2.5 size-1.5 bg-text" aria-hidden="true" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
