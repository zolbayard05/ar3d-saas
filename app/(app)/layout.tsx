import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No blanket redirect here anymore. This group now has one route that
  // must render for a signed-out visitor — /dashboard, the public showcase
  // feed — alongside two that must still require a session — /library,
  // /create. Each of those two already independently calls getUser() and
  // redirects on its own (rule 30: a layout/proxy check is never the only
  // gate), so removing the check here doesn't loosen anything for them; it
  // only stops blocking the one route that's supposed to be open.

  // For BottomNav's create-icon badge — no badge to show for a signed-out
  // visitor, and no "own rows" to query without a user id.
  const { data: activeJobs } = user
    ? await supabase
        .from("models")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"])
        .limit(1)
    : { data: null };

  // BottomNav is `fixed` (rule 39) — out of normal flow regardless of this
  // wrapper's own display type, so it no longer occupies a row in this flex
  // column the way the old full-width bar did.
  //
  // `fixed inset-0`, not a height unit (h-dvh, min-h-dvh, or otherwise): the
  // inner `flex-1 min-h-0 overflow-y-auto` scroll container (HomeFeed,
  // LibraryFeed) needs SOME ancestor to be a real, definite-height ceiling
  // for its own overflow to actually engage — that part of the original
  // reasoning was right. What was wrong was assuming a `dvh`-based height
  // was a stable way to provide that ceiling on iOS Safari: dvh is defined
  // to live-track the browser chrome collapsing/expanding on scroll, and
  // there's a currently open WebKit bug (bugs.webkit.org #297779) where
  // `position: fixed` elements — BottomNav, right here — don't reliably
  // stay in sync with that live value, so the "ceiling" and the "floor"
  // drift apart specifically WHILE the user scrolls, which is exactly when
  // it's most visible.
  //
  // `inset: 0` on a `fixed` element sidesteps the whole class of bug: it's
  // computed directly against the real viewport edges on every paint, not
  // cached as a height value that a second, independent calculation (dvh)
  // has to stay synchronized with. This is the same mechanism BottomNav's
  // own `fixed` positioning already relies on — now both this div's box and
  // BottomNav's position are defined the same way, against the same live
  // viewport, instead of one being viewport-relative (fixed) and the other
  // being a periodically-recomputed height (dvh).
  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      {/* lg:pl-60 clears Sidebar's fixed w-60 rail — BottomNav needs no
          equivalent since it's centered over the full-width viewport, not
          docked to one edge. */}
      <main className="flex min-h-0 flex-1 flex-col lg:pl-60">{children}</main>
      <Sidebar hasActiveJob={(activeJobs?.length ?? 0) > 0} userId={user?.id} />
      <BottomNav hasActiveJob={(activeJobs?.length ?? 0) > 0} />
    </div>
  );
}
