"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Plus, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomNavProps {
  /** Shows a badge dot on the create icon — an in-progress job exists (design/07). */
  hasActiveJob?: boolean;
}

// CLAUDE.md rule 39: three separate floating rounded-square buttons, not a
// merged bar — `href: null` marks library (no route yet, screens 07/08's own
// porting turn); a dead-end icon that silently navigates nowhere useful is
// worse than one that visibly does nothing, so it renders inert (dimmed,
// unclickable) rather than aliasing to /dashboard.
const ITEMS = [
  { href: "/dashboard", icon: LayoutGrid, label: "Feed" },
  { href: "/create", icon: Plus, label: "Create" },
  { href: null, icon: Columns2, label: "Library" },
] as const;

export function BottomNav({ hasActiveJob }: BottomNavProps) {
  const pathname = usePathname();

  // design/02-detail.png is edge-to-edge with a single bottom-docked AR CTA
  // in the nav's own screen position — a floating nav group stacked over
  // that button would reintroduce the equal-weight problem the detail view
  // is specifically designed to avoid.
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
      {ITEMS.map(({ href, icon: Icon, label }, i) => {
        const active = href !== null && pathname === href;
        const isCreate = label === "Create";
        const icon = <Icon className={cn("size-6", active ? "text-text" : "text-text-muted")} />;

        if (href === null) {
          return (
            <span
              key={label}
              aria-hidden="true"
              className="pointer-events-auto flex size-14 items-center justify-center rounded-lg bg-nav-fill opacity-40"
            >
              {icon}
            </span>
          );
        }

        return (
          <Link
            key={label + i}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="pointer-events-auto relative flex size-14 items-center justify-center rounded-lg bg-nav-fill"
          >
            {icon}
            {isCreate && hasActiveJob && (
              <span className="absolute right-2.5 top-2.5 size-1.5 bg-text" aria-hidden="true" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
