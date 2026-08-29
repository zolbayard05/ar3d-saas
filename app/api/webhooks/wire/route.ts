import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyWireWebhookSignature,
  getWireWebhookSecret,
  type WireEvent,
} from "@/lib/wire";

/**
 * wire.mn payment webhook. Verify signature -> resolve the credit_purchases
 * row -> grant credits, in that order (rule 13's ordering, applied here:
 * never act on an unverified payload). Idempotent on the state transition,
 * not on receipt (rule 16) — complete_credit_purchase's own WHERE clause
 * (status <> 'completed') is what actually makes a duplicate delivery a
 * no-op; this handler doesn't need to track "have I seen this event id
 * before" itself.
 *
 * docs.wire.mn/docs/guides/webhooks: every delivery carries
 * WirePayment-Signature: t=<unix>,v1=<hex hmac>. A newly-created endpoint
 * starts `pending` and must answer an `endpoint.verification` ping with 2xx
 * before wire.mn will send it any real event — handled below as a plain
 * no-op ack, same as any other event type this handler doesn't act on.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("WirePayment-Signature");

  if (!verifyWireWebhookSignature(rawBody, signature, getWireWebhookSecret())) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: WireEvent;
  try {
    event = JSON.parse(rawBody) as WireEvent;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  if (event.type !== "payment_intent.succeeded") {
    // Includes endpoint.verification (the initial ping) and every other
    // event type this app doesn't act on — ack 200 rather than erroring, or
    // wire.mn retries a delivery that will never resolve to anything (same
    // rationale as app/api/webhooks/tripo/route.ts's own unmatched-event
    // branch).
    return NextResponse.json({
      ok: true,
      note: `ignored event type=${event.type}`,
    });
  }

  const paymentIntent = event.data;
  const purchaseId = paymentIntent?.metadata?.credit_purchase_id;

  if (!purchaseId) {
    console.warn(
      `Wire webhook: payment_intent.succeeded with no metadata.credit_purchase_id (pi=${paymentIntent?.id})`,
    );
    return NextResponse.json({
      ok: true,
      note: "no credit_purchase_id in metadata",
    });
  }

  const admin = createAdminClient();
  const granted = await admin.rpc("complete_credit_purchase", {
    purchase_id: purchaseId,
    payment_id: paymentIntent.id,
  });

  if (granted.error) {
    // A real failure to call the function (not "already completed", which
    // the function itself returns as `false`, not an error) — 500 so
    // wire.mn retries the delivery rather than silently losing a paid
    // credit grant.
    console.error(
      `Wire webhook: complete_credit_purchase failed for purchase=${purchaseId}`,
      granted.error,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    note: granted.data ? "credits granted" : "already processed",
  });
}
