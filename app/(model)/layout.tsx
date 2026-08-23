import type { ReactNode } from "react";

// Unlike app/(app)/layout.tsx, this group has no auth check and renders no
// BottomNav — /models/[id] (the only route in this group) must render for a
// signed-out visitor following a shared link (migration 0011's public
// select-ready RLS policy is what actually authorizes the data; this layout
// just doesn't get in the way of it). BottomNav would render null here
// regardless (it self-hides on any /models/ path), so omitting it changes
// nothing visually for a signed-in viewer either. Same flex/min-h-dvh shell
// as (app)/layout.tsx, reused exactly, since ModelDetail's own root div
// (`min-h-0 flex-1`) depends on a bounded-height flex ancestor.
export default function ModelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
