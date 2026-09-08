import { Compass, Camera, Boxes, type LucideIcon } from "lucide-react";

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
  { href: "/dashboard", icon: Compass, label: "Нүүр", key: "home" },
  { href: "/create", icon: Camera, label: "Үүсгэх", key: "create" },
  { href: "/library", icon: Boxes, label: "Миний Model", key: "library" },
];
