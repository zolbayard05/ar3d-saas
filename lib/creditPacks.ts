// Placeholder catalogue — the real numbers are an unmade business decision
// (no wire.mn merchant approval yet, so there's nothing to price against:
// no confirmed per-transaction fee tier, no confirmed payout schedule).
// amountMnt here is a rough per-credit-times-10 guess, NOT a quoted price —
// every card built from this list must make that visibly clear (see
// components/BuyCredits.tsx's "Тун удахгүй" note) rather than implying a
// real checkout is one tap away.
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
