import { NextResponse } from "next/server";
import { CREDIT_PACKS, applyFirstPurchaseDiscount } from "@/lib/creditPacks";
import { resolveApiToken } from "@/lib/apiToken";
import { isFirstPurchaseEligible } from "@/lib/checkout";

/**
 * Still reachable without a token (no user-specific data in that case,
 * just current pricing — lib/creditPacks.ts, the same source
 * components/BuyCredits.tsx reads directly at build time) — the extension
 * has no bundler to import that module into extension/popup.js at build
 * time, so it fetches this instead, at runtime, which also means pricing
 * changes never need a matching extension release.
 *
 * Optionally authed on top of that (2026-09-09): extension/popup.js's own
 * "Buy credits" nav button only ever shows once a token is connected (its
 * own state-machine gates it behind the same check that unlocks every
 * other authed view), so by the time this is actually called in practice a
 * Bearer token is always present — resolving it lets the popup preview the
 * exact first-purchase-discount price lib/checkout.ts's startCheckout()
 * will actually charge, the same way app/(app)/credits/page.tsx already
 * does for the web app's own BuyCredits.tsx. A missing/invalid token just
 * falls back to the plain, non-personalized packs rather than erroring —
 * this endpoint was never meant to require auth.
 */
export async function GET(request: Request) {
  const userId = await resolveApiToken(request);
  const eligible = userId ? await isFirstPurchaseEligible(userId) : false;

  const packs = CREDIT_PACKS.map((pack) => ({
    ...pack,
    discountedAmountMnt: applyFirstPurchaseDiscount(pack.amountMnt),
  }));

  return NextResponse.json({ packs, firstPurchaseEligible: eligible });
}
