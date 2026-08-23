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
// CLAUDE.md's decision log). Library doesn't have its own route yet (that's
// screens 07/08's own porting turn) — points at /dashboard for now, a
// known, temporary rough edge, not a finished library screen.
const ITEMS = [
  { href: "/dashboard", icon: LayoutGrid, label: "Feed" },
  { href: "/create", icon: Plus, label: "Create" },
  { href: "/dashboard", icon: Columns2, label: "Library" },
] as const;

export function BottomNav({ hasActiveJob }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex h-14 shrink-0 items-center justify-around border-t border-border-subtle bg-bg">
      {ITEMS.map(({ href, icon: Icon, label }, i) => {
        const active = pathname === href;
        const isCreate = label === "Create";
        return (
          <Link
            key={label + i}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="relative flex items-center justify-center p-3"
          >
            <Icon className={cn("size-5", active ? "text-text" : "text-text-muted")} />
            {isCreate && hasActiveJob && (
              <span className="absolute right-2 top-2 size-1.5 bg-text" aria-hidden="true" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
