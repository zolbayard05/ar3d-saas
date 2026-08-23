"use client";

import { useAuth } from "@/hooks/useAuth";

// Its home is the library screen's footer links (plan/help/sign out) — a
// plain grey text link, not the icon button this was before AppHeader.tsx
// (its only prior consumer) was removed as dead code. No other consumer to
// preserve a different look for.
export function SignOutButton() {
  const { signOut } = useAuth();

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="text-small uppercase tracking-wide text-text-muted hover:text-text"
    >
      Sign out
    </button>
  );
}
