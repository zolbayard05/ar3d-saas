import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_PREFIX = "rf_live_";

export interface GeneratedToken {
  token: string;
  hash: string;
  last4: string;
}

/** Long enough to be unguessable; prefixed so a leaked token is greppable/revocable at a glance. */
export function generateToken(): GeneratedToken {
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  return { token, hash: hashToken(token), last4: secret.slice(-4) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Resolves a Bearer token (from app/api/extension/* requests) to a user id,
 * or null. This mirrors what supabase.auth.getUser() does for the
 * cookie-based path — an independent, per-request verification (CLAUDE.md
 * rule 30) — it is the entire trust boundary for every /api/extension/*
 * route. Never caches a result across requests: a revoked token must be
 * rejected on the very next call.
 */
export async function resolveApiToken(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  const token = auth?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;

  const admin = createAdminClient();
  const hash = hashToken(token);
  const { data } = await admin
    .from("api_tokens")
    .select("user_id")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!data) return null;

  // Best-effort — never block/fail auth on this write.
  void admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);

  return data.user_id;
}
