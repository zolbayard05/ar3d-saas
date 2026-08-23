"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Plus, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomNavProps {
  /** Shows a badge dot on the create icon — an in-progress job exists (design/07). */
  hasActiveJob?: boolean;
}

// design/07-library.png, design/08-library-empty.png: 3 icons, no labels,
// active white / inactive grey (rule: one nav set everywhere — see
// CLAUDE.md's decision log). `href: null` marks library: it has no route
// yet (that's screens 07/08's own porting turn), and a dead-end icon that
// silently navigates nowhere useful is worse than one that visibly does
// nothing — so it renders inert (dimmed, unclickable) rather than aliasing
// to /dashboard.
const ITEMS = [
  { href: "/dashboard", icon: LayoutGrid, label: "Feed" },
  { href: "/create", icon: Plus, label: "Create" },
  { href: null, icon: Columns2, label: "Library" },
] as const;

export function BottomNav({ hasActiveJob }: BottomNavProps) {
  const pathname = usePathname();

  // design/02-detail.png is edge-to-edge with a single bottom-docked AR CTA
  // in the nav's own screen position — a persistent nav bar stacked under
  // that button would reintroduce the equal-weight problem the detail view
  // is specifically designed to avoid.
  if (pathname?.startsWith("/models/")) return null;

  return (
    <nav className="flex h-14 shrink-0 items-center justify-around border-t border-border-subtle bg-bg">
      {ITEMS.map(({ href, icon: Icon, label }, i) => {
        const active = href !== null && pathname === href;
        const isCreate = label === "Create";
        const icon = <Icon className={cn("size-5", active ? "text-text" : "text-text-muted")} />;

        if (href === null) {
          return (
            <span
              key={label}
              aria-hidden="true"
              className="flex items-center justify-center p-3 opacity-40"
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
            className="relative flex items-center justify-center p-3"
          >
            {icon}
            {isCreate && hasActiveJob && (
              <span className="absolute right-2 top-2 size-1.5 bg-text" aria-hidden="true" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
