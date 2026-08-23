/**
 * Client-safe (no server-only import) — used from both Server and Client
 * Components to turn a stored R2 key (see app/api/webhooks/tripo/route.ts)
 * into a fetchable URL.
 *
 * The whole point of this indirection: NEXT_PUBLIC_MODELS_CDN_URL is the
 * single place that changes when the real domain goes live (rule 4 — never
 * point this at *.r2.dev). Until then it points at the local dev proxy
 * (app/api/models/[...key]/route.ts) instead — swapping to
 * https://cdn.<domain> later is a one-line env var change, nothing here.
 */
export function buildModelUrl(key: string): string {
  const prefix = process.env.NEXT_PUBLIC_MODELS_CDN_URL || "/api/models";
  return `${prefix.replace(/\/$/, "")}/${key}`;
}
