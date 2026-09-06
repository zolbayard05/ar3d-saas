import { notFound } from "next/navigation";
import { AR_SHOWCASE_ITEMS } from "@/lib/arShowcaseItems";
import { ArLaunchView } from "@/components/ArLaunchView";

/**
 * Phone-only landing for the desktop showcase section's QR code
 * (components/DesktopShowcaseSection.tsx) — no DB row, no auth: these are
 * static demo assets, not a user's generated model. A desktop UA never
 * reaches this render (lib/supabase/proxy.ts's device gate bounces it to
 * "/" before this runs, same as it already does for /models/[id]) — that's
 * fine, this route only exists for the phone that scanned the code.
 */
export default async function ArShowcasePage({ params }: { params: Promise<{ item: string }> }) {
  const { item } = await params;
  const found = AR_SHOWCASE_ITEMS.find((i) => i.key === item);
  if (!found) notFound();

  return <ArLaunchView item={found} />;
}
