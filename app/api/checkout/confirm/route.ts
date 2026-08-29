import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentIntent } from "@/lib/wire";

/**
 * Fallback confirmation for a wire.mn purchase — called once when the user
 * lands back on success_url (see app/api/checkout/route.ts). Exists
 * because the webhook endpoint got stuck `pending` (see lib/wire.ts's
 * getPaymentIntent comment) and can't be relied on right now; wire.mn's
 * own docs say polling the PaymentIntent directly is a legitimate primary
 * path, not just a stopgap — the webhook stays wired up as a bonus for
 * instant confirmation once/if it starts verifying.
 *
 * Safe to call repeatedly (a page refresh, a slow network retry): ownership
 * is checked before anything else, and complete_credit_purchase's own
 * status-transition guard (rule 16) makes a second call here, or a webhook
 * delivery landing later for the SAME purchase, a no-op rather than a
 * double grant.
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

  const { purchaseId } = (body ?? {}) as { purchaseId?: unknown };
  if (typeof purchaseId !== "string" || !purchaseId) {
    return NextResponse.json(
      { error: "purchaseId дутуу байна" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Ownership check (rule 30) — purchaseId comes from a URL query param the
  // caller's own browser controls, so this must not trust it blindly.
  const { data: purchase } = await admin
    .from("credit_purchases")
    .select("id, status, provider_payment_id")
    .eq("id", purchaseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!purchase) {
    return NextResponse.json(
      { error: "Худалдан авалт олдсонгүй" },
      { status: 404 },
    );
  }

  if (purchase.status === "completed") {
    return NextResponse.json({ status: "completed" });
  }

  if (!purchase.provider_payment_id) {
    // Checkout was started but never reached wire.mn (the PaymentIntent
    // creation itself failed) — app/api/checkout/route.ts already marks
    // this `failed` in that case, so this is defensive, not the expected
    // path.
    return NextResponse.json({ status: purchase.status });
  }

  let paymentIntent;
  try {
    paymentIntent = await getPaymentIntent(purchase.provider_payment_id);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Төлбөрийн статус шалгахад алдаа гарлаа",
      },
      { status: 502 },
    );
  }

  if (paymentIntent.status !== "succeeded") {
    // Still requires_payment_method / processing / canceled — nothing to
    // grant yet, not an error. The client can poll again or just show
    // "хүлээгдэж байна" for this status.
    return NextResponse.json({ status: paymentIntent.status });
  }

  const granted = await admin.rpc("complete_credit_purchase", {
    purchase_id: purchase.id,
    payment_id: paymentIntent.id,
  });

  if (granted.error) {
    console.error(
      `Checkout confirm: complete_credit_purchase failed for purchase=${purchase.id}`,
      granted.error,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ status: "completed" });
}
