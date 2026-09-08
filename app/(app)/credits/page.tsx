import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFirstPurchaseEligible } from "@/lib/checkout";
import { BuyCredits } from "@/components/BuyCredits";

// Same pattern as app/(app)/library/page.tsx — getUser() here directly,
// not just proxy.ts's PROTECTED_PREFIXES entry (rule 30).
export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Resolved server-side so BuyCredits shows the same (discounted or not)
  // price the real wire.mn charge will use — lib/checkout.ts's
  // startCheckout() is the actual source of truth for the amount charged.
  const eligible = await isFirstPurchaseEligible(user.id);

  return <BuyCredits isFirstPurchaseEligible={eligible} />;
}
