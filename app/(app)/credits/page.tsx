import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuyCredits } from "@/components/BuyCredits";

// Same pattern as app/(app)/library/page.tsx — getUser() here directly,
// not just proxy.ts's PROTECTED_PREFIXES entry (rule 30).
export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <BuyCredits />;
}
