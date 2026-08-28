import { LayoutGrid, Plus, Columns2, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  key: string;
}

// Single source of truth for both BottomNav (mobile, icon-only floating
// buttons, rule 39) and Sidebar (desktop, icon+label rail) — one nav model
// rendered two different ways depending on viewport, not two independently
// maintained lists that could drift.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: LayoutGrid, label: "Нүүр", key: "home" },
  { href: "/create", icon: Plus, label: "Үүсгэх", key: "create" },
  { href: "/library", icon: Columns2, label: "Миний Model", key: "library" },
];
