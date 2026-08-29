import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * wire.mn (Mongolian Stripe-like payment gateway) REST client + webhook
 * verification. Field/endpoint names below are sourced directly from
 * docs.wire.mn (Quickstart, Authentication, Hosted checkout, Webhooks,
 * Object schemas, and the generated API reference for POST
 * /v1/payment_intents specifically) — read 2026-08-29, not guessed. The
 * checkout/sessions request shape is the one exception: it's documented in
 * the Quickstart/Hosted-checkout guides with a curl -d example but doesn't
 * appear in the generated (OpenAPI) API reference, so its exact
 * content-type wasn't independently confirmed the way payment_intents' was
 * (application/json, confirmed against the reference page). Sent as JSON
 * here on the assumption the API is consistent across endpoints — confirm
 * against a real sandbox call before relying on this in prod.
 */

const API_BASE = "https://api.wire.mn/v1";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.example`);
  return value;
}

function getApiKey(): string {
  return requiredEnv("WIRE_API_KEY");
}

export function getWireWebhookSecret(): string {
  return requiredEnv("WIRE_WEBHOOK_SECRET");
}

// "50000 гэдэг нь 500.00 ₮" (docs.wire.mn/docs/quickstart) — amounts are
// always integer minor units, ratio 100 to MNT major units.
export function mntToMinorUnits(mnt: number): number {
  return Math.round(mnt * 100);
}

interface WireErrorBody {
  error?: {
    type?: string;
    code?: string;
    message?: string;
    request_id?: string;
  };
}

async function wireFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey
        ? { "Idempotency-Key": init.idempotencyKey }
        : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const parsed = (await res.json().catch(() => null)) as
    (T & WireErrorBody) | null;

  if (!res.ok) {
    const message =
      parsed?.error?.message || `wire.mn ${path} failed: HTTP ${res.status}`;
    throw new Error(message);
  }
  if (!parsed)
    throw new Error(`wire.mn ${path} returned an unparseable response`);
  return parsed;
}

export interface WirePaymentIntent {
  id: string;
  object: "payment_intent";
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, string>;
  livemode: boolean;
}

/**
 * automatic_operator: true (the API's own default) — lets wire.mn pick the
 * right operator itself rather than this app hardcoding operator ids, which
 * would otherwise need updating every time the merchant account connects a
 * new one. Works in both test mode (picks the built-in "sandbox" operator)
 * and live mode (picks among the account's connected operators) per
 * docs.wire.mn/docs/concepts/test-mode.
 */
export async function createPaymentIntent(params: {
  amountMinorUnits: number;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}): Promise<WirePaymentIntent> {
  return wireFetch<WirePaymentIntent>("/payment_intents", {
    method: "POST",
    idempotencyKey: params.idempotencyKey,
    body: {
      amount: params.amountMinorUnits,
      currency: "MNT",
      description: params.description,
      automatic_operator: true,
      metadata: params.metadata,
    },
  });
}

export interface WireCheckoutSession {
  id: string;
  object: "checkout.session";
  url: string;
  payment_intent: string;
}

export async function createCheckoutSession(params: {
  paymentIntentId: string;
  successUrl: string;
  cancelUrl?: string;
  idempotencyKey: string;
}): Promise<WireCheckoutSession> {
  return wireFetch<WireCheckoutSession>("/checkout/sessions", {
    method: "POST",
    idempotencyKey: params.idempotencyKey,
    body: {
      payment_intent: params.paymentIntentId,
      success_url: params.successUrl,
      ...(params.cancelUrl ? { cancel_url: params.cancelUrl } : {}),
    },
  });
}

export interface WireEvent {
  id: string;
  object: "event";
  type: string;
  livemode: boolean;
  // Object schemas page: "data: object — The event payload (e.g. the
  // affected resource)" — read as the resource itself (a PaymentIntent for
  // payment_intent.* events), not Stripe's nested data.object convention.
  data: WirePaymentIntent & Record<string, unknown>;
}

/**
 * Identical scheme to lib/tripo.ts's verifyTripoWebhookSignature — Stripe-
 * style header `t=<unix_seconds>,v1=<hex_hmac>[,v1=...]`, HMAC-SHA256 of
 * `${t}.${rawBody}` keyed by the whsec_ secret, constant-time compared
 * against every v1 value present (secret rotation support), rejected
 * outside a replay-tolerance window. Duplicated rather than imported from
 * lib/tripo.ts on purpose: these are two unrelated providers whose schemes
 * happen to match, not a real reason to couple the two integrations.
 */
export function verifyWireWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader) return false;

  let timestamp: string | undefined;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp))
    return false;

  const signedAtMs = Number(timestamp) * 1000;
  if (Math.abs(Date.now() - signedAtMs) > toleranceSeconds * 1000) return false;

  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(rawBody, "utf8");
  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf8"),
    bodyBuffer,
  ]);
  const expected = createHmac("sha256", secret).update(signedPayload).digest();

  return signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    const actual = Buffer.from(sig, "hex");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  });
}
