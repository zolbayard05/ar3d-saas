import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth — proxy.ts already redirects unauthenticated requests
  // away from this route group, but a layout should never trust that alone.
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppHeader userId={user.id} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
