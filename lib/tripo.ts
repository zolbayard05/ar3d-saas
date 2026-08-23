import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tripo API V3 client (image → 3D generation) and webhook verification.
 *
 * Field/endpoint names below are sourced from Tripo's V3 OpenAPI spec as
 * reconstructed at https://github.com/tryAGI/Tripo (a third-party SDK —
 * Tripo doesn't publish a public machine-readable schema, per that repo's
 * own spec header) and cross-checked against its webhook-signature source
 * and README. Confirmed, not guessed:
 *   - base URL, Bearer auth, POST /generation/image-to-model,
 *     POST /models/convert, response envelope { code, data }.
 *   - webhook signature scheme (Stripe-style t=/v1= HMAC-SHA256, see below).
 *   - there is NO per-request callback_url field anywhere in the spec — the
 *     webhook URL is configured out-of-band in the Tripo developer console.
 *     CLAUDE.md rule 12 describes "submit the job with a callback_url"; that
 *     doesn't match V3. Flagged to the user — the console-configured webhook
 *     is what actually delivers events here.
 * Not independently verified against a live account: the exact set of
 * `model` version strings still offered (TRIPO_MODEL_VERSION below is
 * configurable for exactly this reason) and real end-to-end payload
 * behavior. Confirm against a live task before relying on this in prod.
 */

const API_BASE = "https://openapi.tripo3d.ai/v3";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.example`);
  return value;
}

function getApiKey(): string {
  return requiredEnv("TRIPO_API_KEY");
}

// v2.5-20250123 is the version the SDK docs call out as preserving V2's
// former default behavior — a documented, deliberate choice rather than
// picking the newest dated version, which could change output style /
// pricing out from under us without a code change. Override via env once
// you've decided that's worth it.
function getModelVersion(): string {
  return process.env.TRIPO_MODEL_VERSION || "v2.5-20250123";
}

type TripoEnvelope<T> = { code: number; status?: string; data: T };

export type TripoTaskStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export interface TripoTaskOutput {
  model_url?: string;
  [key: string]: unknown;
}

export interface TripoTask {
  task_id: string;
  type?: string;
  status: TripoTaskStatus;
  output?: TripoTaskOutput;
  error_code?: number;
  error_message?: string;
}

async function tripoFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as TripoEnvelope<T> | null;

  if (!res.ok || !json || json.code !== 0) {
    const detail = json ? JSON.stringify(json) : `HTTP ${res.status}`;
    throw new Error(`Tripo ${path} failed: ${detail}`);
  }

  return json.data;
}

/**
 * Submits the image-to-model task. `sourceImageUrl` is a short-lived
 * presigned GET URL for the photo in our private `uploads` bucket — Tripo
 * fetches it once at submission time, so the expiry only needs to outlive
 * network latency, not the generation itself (rule 6 is about long-lived
 * shared AR links on the *models* bucket; this is a one-shot ingestion
 * fetch on a different, private bucket — not the same concern).
 */
export async function submitImageToModelTask(sourceImageUrl: string): Promise<{ taskId: string }> {
  const data = await tripoFetch<{ task_id: string }>("/generation/image-to-model", {
    model: getModelVersion(),
    input: sourceImageUrl,
  });
  return { taskId: data.task_id };
}

/**
 * Submits a format-conversion task from an already-completed model task to
 * USDZ (rule 1: every model needs both .glb and .usdz; Tripo's image-to-model
 * task only produces the former — USDZ requires this second, separate async
 * task keyed off the first task's id).
 */
export async function submitUsdzConversionTask(sourceTaskId: string): Promise<{ taskId: string }> {
  const data = await tripoFetch<{ task_id: string }>("/models/convert", {
    input: sourceTaskId,
    format: "USDZ",
  });
  return { taskId: data.task_id };
}

/**
 * Verifies a Tripo webhook signature. Stripe-style scheme, confirmed from
 * the reference SDK's actual verifier source (github.com/tryAGI/Tripo):
 *   header: "Tripo-Webhook-Signature: t=<unix_seconds>,v1=<hex_hmac>[,v1=<hex_hmac>...]"
 *   signed message: `${t}.${rawBody}` (exact raw bytes, before JSON parsing)
 *   mac: HMAC-SHA256(key = secret string incl. its "whsec_" prefix, message)
 *   compare: constant-time, against every v1 value present (supports
 *            secret rotation — a valid match on ANY of them passes)
 *   replay window: reject if |now - t| exceeds toleranceSeconds
 */
export function verifyTripoWebhookSignature(
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

  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) return false;

  const signedAtMs = Number(timestamp) * 1000;
  if (Math.abs(Date.now() - signedAtMs) > toleranceSeconds * 1000) return false;

  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), bodyBuffer]);
  const expected = createHmac("sha256", secret).update(signedPayload).digest();

  return signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    const actual = Buffer.from(sig, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export function getWebhookSecret(): string {
  return requiredEnv("TRIPO_WEBHOOK_SECRET");
}
