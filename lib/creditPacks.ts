// Placeholder catalogue — the real numbers are still an unmade business
// decision (wire.mn merchant approval came through 2026-08-29, but the
// per-transaction fee tier / payout schedule from the actual contract
// hasn't been priced against yet). amountMnt here is a rough
// per-credit-times-10 guess, NOT a quoted price — every card built from
// this list must make that visibly clear (see components/BuyCredits.tsx's
// "Тун удахгүй" note) rather than implying a real checkout is one tap away.
// app/api/checkout/route.ts already reads `id` and `amountMnt` from here as
// the real amount to charge once that UI note is lifted, so these IDs are
// now load-bearing, not just display data — don't rename/remove one
// without checking that route.
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
