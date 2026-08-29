import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaymentIntent, createCheckoutSession } from "@/lib/wire";
import { CREDIT_PACKS } from "@/lib/creditPacks";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Starts a wire.mn hosted-checkout purchase for one credit pack. Mirrors
 * app/api/generate/route.ts's own shape closely (rule 12's async pattern,
 * applied here to a payment instead of a generation): validate -> idempotent
 * fast path -> insert a `pending` row via service_role -> call the external
 * provider -> return a redirect target immediately. The actual credit grant
 * happens later, in app/api/webhooks/wire/route.ts, once wire.mn confirms
 * the payment — never here, and never on the client-visible redirect alone
 * (docs.wire.mn/docs/guides/webhooks: "Зөвхөн redirect-д хэзээ ч бүү найд").
 *
 * Unlike /api/generate, no credit is deducted upfront here — there's
 * nothing to refund on failure, just a `pending` row that never completes
 * (or gets explicitly marked `failed` below) if wire.mn's API call itself
 * fails.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Буруу JSON бие" }, { status: 400 });
  }

  const { packId, idempotencyKey } = (body ?? {}) as {
    packId?: unknown;
    idempotencyKey?: unknown;
  };

  if (typeof idempotencyKey !== "string" || !UUID_RE.test(idempotencyKey)) {
    return NextResponse.json(
      { error: "idempotencyKey буруу эсвэл дутуу байна (UUID байх ёстой)" },
      { status: 400 },
    );
  }

  // Server recomputes credits/amount from packId — the client never gets to
  // supply either directly (same reasoning as every other money-touching
  // route in this app: rule 33/35's "never trust a client-writable value
  // for something server-only", applied here to price rather than a DB
  // column grant).
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Багц олдсонгүй" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fast path: a retry of the same attempt (lost response, double-click)
  // resends this exact key — return the already-created row's checkout
  // rather than starting a second PaymentIntent for it.
  const { data: existing } = await admin
    .from("credit_purchases")
    .select("id, status, provider_payment_id")
    .eq("user_id", user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing?.status === "completed") {
    return NextResponse.json(
      { error: "Энэ худалдан авалт аль хэдийн дууссан байна" },
      { status: 409 },
    );
  }

  let purchaseId: string;
  if (existing) {
    purchaseId = existing.id;
  } else {
    const { data: purchase, error: insertError } = await admin
      .from("credit_purchases")
      .insert({
        user_id: user.id,
        credits: pack.credits,
        amount_mnt: pack.amountMnt,
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (insertError || !purchase) {
      return NextResponse.json(
        { error: "Худалдан авалт эхлүүлэхэд алдаа гарлаа" },
        { status: 500 },
      );
    }
    purchaseId = purchase.id;
  }

  const origin = new URL(request.url).origin;

  try {
    const paymentIntent = await createPaymentIntent({
      amountMnt: pack.amountMnt,
      description: `${pack.credits} кредит — Realify`,
      metadata: { credit_purchase_id: purchaseId, user_id: user.id },
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
      // fallback confirmation on return (see lib/wire.ts's
      // getPaymentIntent comment for why that fallback exists at all).
      successUrl: `${origin}/library?purchase=${purchaseId}`,
      cancelUrl: `${origin}/credits`,
      idempotencyKey: `cs-${idempotencyKey}`,
    });

    await admin
      .from("credit_purchases")
      .update({ provider_payment_id: paymentIntent.id })
      .eq("id", purchaseId)
      .is("provider_payment_id", null);

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    await admin
      .from("credit_purchases")
      .update({ status: "failed" })
      .eq("id", purchaseId)
      .eq("status", "pending");
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Төлбөр эхлүүлэхэд алдаа гарлаа",
      },
      { status: 502 },
    );
  }
}
