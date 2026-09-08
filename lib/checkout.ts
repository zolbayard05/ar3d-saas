import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaymentIntent, createCheckoutSession } from "@/lib/wire";
import { CREDIT_PACKS, applyFirstPurchaseDiscount } from "@/lib/creditPacks";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StartCheckoutResult = { ok: true; url: string } | { ok: false; status: number; error: string };

/**
 * Whether `userId` has never completed a purchase — the gate for
 * lib/creditPacks.ts's FIRST_PURCHASE_DISCOUNT_RATE. Exported so
 * app/(app)/credits/page.tsx can resolve the same answer server-side to
 * show BuyCredits.tsx the correct (discounted or not) price up front,
 * rather than the purchase screen and the actual wire.mn charge disagreeing.
 *
 * Accepted edge case: two concurrent checkout attempts from the same
 * never-purchased user (e.g. two tabs) could both read zero completed
 * purchases and both get the discount once each — a minor promo-abuse
 * window, not a security issue, not worth a heavier lock for this.
 */
export async function isFirstPurchaseEligible(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("credit_purchases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");
  return (count ?? 0) === 0;
}

/**
 * Shared by app/api/checkout/route.ts (cookie-authed web app) and
 * app/api/extension/checkout/route.ts (token-authed Chrome extension) — the
 * whole wire.mn PaymentIntent + hosted-checkout-session flow lives here once,
 * same reasoning as lib/generateModel.ts's submitGeneration: two entry
 * points independently verify their own caller (rule 30) and then both trust
 * this function with the resulting userId, so the idempotency/pricing
 * guarantees below can't drift between them.
 *
 * No credit is deducted upfront here — there's nothing to refund on failure,
 * just a `pending` credit_purchases row that never completes (or gets
 * explicitly marked `failed` below) if wire.mn's own API call fails. The
 * actual credit grant happens later, in app/api/webhooks/wire/route.ts, once
 * wire.mn confirms the payment — never here, and never off the client-visible
 * redirect alone (docs.wire.mn/docs/guides/webhooks: "Зөвхөн redirect-д хэзээ
 * ч бүү найд").
 */
export async function startCheckout(
  userId: string,
  input: { packId: unknown; idempotencyKey: unknown },
  origin: string,
): Promise<StartCheckoutResult> {
  const { packId, idempotencyKey } = input;

  if (typeof idempotencyKey !== "string" || !UUID_RE.test(idempotencyKey)) {
    return { ok: false, status: 400, error: "idempotencyKey буруу эсвэл дутуу байна (UUID байх ёстой)" };
  }

  // Server recomputes credits/amount from packId — the client never gets to
  // supply either directly (rule 33/35's "never trust a client-writable
  // value for something server-only", applied here to price rather than a
  // DB column grant).
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return { ok: false, status: 400, error: "Багц олдсонгүй" };
  }

  const admin = createAdminClient();

  // Fast path: a retry of the same attempt (lost response, double-click)
  // resends this exact key — return the already-created row's checkout
  // rather than starting a second PaymentIntent for it. amount_mnt is
  // fetched too so a retry reuses whatever was already decided for this
  // row (discounted or not) instead of re-running the eligibility check.
  const { data: existing } = await admin
    .from("credit_purchases")
    .select("id, status, provider_payment_id, amount_mnt")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing?.status === "completed") {
    return { ok: false, status: 409, error: "Энэ худалдан авалт аль хэдийн дууссан байна" };
  }

  let purchaseId: string;
  let chargeAmountMnt: number;
  if (existing) {
    purchaseId = existing.id;
    chargeAmountMnt = existing.amount_mnt;
  } else {
    // First-purchase discount (lib/creditPacks.ts) — decided once, here,
    // for a brand-new purchase attempt only; credits stays the pack's full
    // value regardless (see isFirstPurchaseEligible's own comment for why
    // that's sufficient).
    const eligible = await isFirstPurchaseEligible(userId);
    chargeAmountMnt = eligible ? applyFirstPurchaseDiscount(pack.amountMnt) : pack.amountMnt;

    const { data: purchase, error: insertError } = await admin
      .from("credit_purchases")
      .insert({
        user_id: userId,
        credits: pack.credits,
        amount_mnt: chargeAmountMnt,
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (insertError || !purchase) {
      return { ok: false, status: 500, error: "Худалдан авалт эхлүүлэхэд алдаа гарлаа" };
    }
    purchaseId = purchase.id;
  }

  try {
    const paymentIntent = await createPaymentIntent({
      amountMnt: chargeAmountMnt,
      description: `${pack.credits} кредит — Realify`,
      metadata: { credit_purchase_id: purchaseId, user_id: userId },
      // Namespaced under the purchase's own key — a distinct wire.mn
      // resource (the PaymentIntent) needs its own idempotency key, not a
      // literal reuse of the row's key, or a retry that also re-derives the
      // checkout-session key below from the SAME string would collide.
      idempotencyKey: `pi-${idempotencyKey}`,
    });

    const session = await createCheckoutSession({
      paymentIntentId: paymentIntent.id,
      // ?purchase=<id>, not a bare "success" flag — LibraryFeed.tsx needs
      // the actual purchaseId to call app/api/checkout/confirm/route.ts's
      // fallback confirmation on return (see lib/wire.ts's getPaymentIntent
      // comment for why that fallback exists at all). Same redirect target
      // regardless of whether checkout was started from the web app or the
      // extension (which opens this in a real browser tab, not its popup) —
      // it's the same website either way.
      successUrl: `${origin}/library?purchase=${purchaseId}`,
      cancelUrl: `${origin}/credits`,
      idempotencyKey: `cs-${idempotencyKey}`,
    });

    await admin
      .from("credit_purchases")
      .update({ provider_payment_id: paymentIntent.id })
      .eq("id", purchaseId)
      .is("provider_payment_id", null);

    return { ok: true, url: session.url };
  } catch (err) {
    await admin.from("credit_purchases").update({ status: "failed" }).eq("id", purchaseId).eq("status", "pending");
    return { ok: false, status: 502, error: err instanceof Error ? err.message : "Төлбөр эхлүүлэхэд алдаа гарлаа" };
  }
}
