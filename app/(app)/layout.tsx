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

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <BottomNav hasActiveJob={(activeJobs?.length ?? 0) > 0} />
    </div>
  );
}
