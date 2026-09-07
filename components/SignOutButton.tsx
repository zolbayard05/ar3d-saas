"use client";

import type { CSSProperties } from "react";
import { useAuth } from "@/hooks/useAuth";

// Its home is the library screen's footer links (plan/help/sign out) — a
// plain grey text link, not the icon button this was before AppHeader.tsx
// (its only prior consumer) was removed as dead code.
//
// className/style are optional overrides (default unchanged) so
// DesktopLanding.tsx's nav — which is token-exempt, hardcoded-style
// Desktop*.tsx per its own convention — can reuse this same signOut() call
// instead of re-implementing it, matching its own "Нэвтрэх" link's look.
export function SignOutButton({ className, style }: { className?: string; style?: CSSProperties }) {
  const { signOut } = useAuth();

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className={className ?? "text-small uppercase tracking-wide text-text-muted hover:text-text"}
      style={style}
    >
      Гарах
    </button>
  );
}
