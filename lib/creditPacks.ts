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
