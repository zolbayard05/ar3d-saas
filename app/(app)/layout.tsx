import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth — proxy.ts already redirects unauthenticated requests
  // away from this route group, but a layout should never trust that alone.
  if (!user) redirect("/login");

  // For BottomNav's create-icon badge (design/07) — RLS already scopes this
  // to the caller's own rows, .eq is just explicit about intent.
  const { data: activeJobs } = await supabase
    .from("models")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .limit(1);

  // BottomNav is now `fixed` (rule 39) — out of normal flow regardless of
  // this wrapper's own display type, so it no longer occupies a row in this
  // flex column the way the old full-width bar did.
  //
  // `h-dvh`, not `min-h-dvh`: a min-height is a floor, not a ceiling, and
  // gives this div nothing to actually cap against. Screens under this
  // group (HomeFeed, LibraryFeed) have their own inner `flex-1 min-h-0
  // overflow-y-auto` scroll container specifically so BottomNav's fixed
  // overlay always sits over that container's own reserved bottom padding,
  // never over card content — but that pattern only works if some ancestor
  // in the chain is actually height-*constrained*. With `min-h-dvh`, this
  // div (and `main`, and body) just grow to fit content instead, the inner
  // div's `overflow-y-auto` never has anything to overflow *within itself*
  // so it never engages, and the whole *page* scrolls instead — at which
  // point BottomNav (fixed to the viewport) ends up sitting over whatever
  // card happens to be at its screen position, not over blank padding.
  // `h-dvh` gives every descendant in that chain a real ceiling to size
  // against; content shorter than the viewport is fine (`overflow` is never
  // set to `hidden` anywhere in this chain), it just leaves blank bg below.
  return (
    <div className="flex h-dvh flex-col bg-bg">
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <BottomNav hasActiveJob={(activeJobs?.length ?? 0) > 0} />
    </div>
  );
}
