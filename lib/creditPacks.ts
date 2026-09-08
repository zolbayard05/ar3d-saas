// LIVE pricing (2026-08-29) — checkout is wired up (components/BuyCredits.tsx,
// app/api/checkout/route.ts) and wire.mn merchant + operator activation are
// both complete, so amountMnt here is what actually gets charged, not a
// placeholder. The per-credit rate (1000₮/credit at pack-5, cheaper per
// credit on the larger packs) was never independently priced against
// wire.mn's actual per-transaction fee — revisit once real fee/payout data
// is available. `id` is load-bearing (app/api/checkout/route.ts looks packs
// up by it) — don't rename/remove one without checking that route.
export interface CreditPack {
  id: string;
  credits: number;
  amountMnt: number;
  /** Shown as a small badge on the middle option — no pricing logic depends on this. */
  highlight?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-5", credits: 5, amountMnt: 5000 },
  { id: "pack-15", credits: 15, amountMnt: 12000, highlight: true },
  { id: "pack-40", credits: 40, amountMnt: 28000 },
];

/**
 * Standing "new customer" perk — 50% off a user's very first completed
 * purchase, any pack. Real, not decorative: lib/checkout.ts's
 * isFirstPurchaseEligible() gates the actual amount wire.mn charges (see
 * that file's own comment for why halving `amount_mnt` alone, while
 * `credits` stays full, is sufficient — complete_credit_purchase grants
 * credits from the row's own `credits` column, independent of what was
 * actually charged). Pure/DB-free so both server code and client
 * components (the landing page, BuyCredits.tsx) can share the same price
 * math for display.
 */
export const FIRST_PURCHASE_DISCOUNT_RATE = 0.5;

export function applyFirstPurchaseDiscount(amountMnt: number): number {
  return Math.round(amountMnt * (1 - FIRST_PURCHASE_DISCOUNT_RATE));
}
