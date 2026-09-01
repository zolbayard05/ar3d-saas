import "server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Client, getUploadsBucket } from "@/lib/r2";
import { submitImageToModelTask } from "@/lib/tripo";

const SOURCE_URL_EXPIRY_SECONDS = 10 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = "23505";

export interface SubmitGenerationInput {
  sourceImageKey: unknown;
  idempotencyKey: unknown;
  sourceImageWidth: unknown;
  sourceImageHeight: unknown;
}

/**
 * consume_credit(uid) (migration 0001) checks `uid = auth.uid()` internally
 * and is granted only to `authenticated` — right for the cookie-based web
 * app (a real Supabase JWT), wrong for a token-authed extension request
 * (no JWT, so auth.uid() is null and the check would always fail).
 * consume_credit_service(uid) (migration 0019) is the service_role-only
 * twin with no auth.uid() check, for callers whose identity was already
 * verified a different way (lib/apiToken.ts's resolveApiToken). Each route
 * passes the RPC call appropriate to how IT authenticated its own caller —
 * this function doesn't choose, it just runs whichever one it's given.
 */
export type ConsumeCredit = () => Promise<{ consumed: boolean } | { error: true }>;

export type SubmitGenerationResult =
  | { ok: true; modelId: string }
  | { ok: false; status: number; error: string };

/**
 * Shared by app/api/generate/route.ts (cookie-authed) and
 * app/api/extension/generate/route.ts (token-authed) — the entire pipeline
 * from CLAUDE.md rule 12 (deduct credit -> insert pending row -> submit to
 * Tripo -> return immediately) lives here exactly once so rule 16-19's
 * idempotency/atomic-credit/refund-on-failure guarantees can't drift
 * between the two entry points. Callers must resolve and independently
 * verify `userId` themselves first (rule 30) — this function trusts it.
 *
 * Uses the admin client throughout (not a cookie-scoped one) because a
 * token-authed caller has no Supabase session/JWT for RLS to key off of —
 * every query below is explicitly scoped to `userId` in the WHERE clause
 * instead, which is what actually enforces ownership here.
 */
export async function submitGeneration(
  userId: string,
  input: SubmitGenerationInput,
  consumeCredit: ConsumeCredit,
): Promise<SubmitGenerationResult> {
  const { sourceImageKey, idempotencyKey, sourceImageWidth, sourceImageHeight } = input;

  const validDimension = (value: unknown): number | null =>
    typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
  const imageWidth = validDimension(sourceImageWidth);
  const imageHeight = validDimension(sourceImageHeight);

  // Must be a key this user could only have gotten via presignUpload,
  // which always derives it as uploads/{userId}/{uuid}.ext (never
  // client-supplied) — re-checking the prefix here stops a caller from
  // pointing generation at another user's uploaded photo by guessing/
  // reusing a key that isn't theirs.
  if (typeof sourceImageKey !== "string" || !sourceImageKey.startsWith(`uploads/${userId}/`)) {
    return { ok: false, status: 400, error: "sourceImageKey буруу эсвэл дутуу байна" };
  }

  if (typeof idempotencyKey !== "string" || !UUID_RE.test(idempotencyKey)) {
    return { ok: false, status: 400, error: "idempotencyKey буруу эсвэл дутуу байна (UUID байх ёстой)" };
  }

  const admin = createAdminClient();

  // Fast path: a retry of the same attempt (lost response, double-click)
  // resends this exact key. If we already have a row for it, this IS that
  // attempt succeeding — return it as-is, no credit touched, no error.
  const { data: existing } = await admin
    .from("models")
    .select("id")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    return { ok: true, modelId: existing.id };
  }

  const creditResult = await consumeCredit();
  if ("error" in creditResult) {
    return { ok: false, status: 500, error: "Кредитийн үлдэгдэл шалгахад алдаа гарлаа" };
  }
  if (!creditResult.consumed) {
    return { ok: false, status: 402, error: "Кредит хүрэлцэхгүй байна" };
  }

  const { data: model, error: insertError } = await admin
    .from("models")
    .insert({
      user_id: userId,
      source_image_key: sourceImageKey,
      status: "pending",
      provider: "tripo",
      idempotency_key: idempotencyKey,
      source_image_width: imageWidth,
      source_image_height: imageHeight,
    })
    .select("id")
    .single();

  if (insertError || !model) {
    // No models row exists yet, so refund_credit (which keys off a model
    // row) can't be used — increment_credit_service (migration 0020) is an
    // atomic UPDATE instead of read-then-write, since this now runs from
    // two concurrent entry points (web app + extension).
    if (insertError?.code === UNIQUE_VIOLATION) {
      await admin.rpc("increment_credit_service", { uid: userId });
      const { data: winner } = await admin
        .from("models")
        .select("id")
        .eq("user_id", userId)
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (winner) {
        return { ok: true, modelId: winner.id };
      }
    } else {
      await admin.rpc("increment_credit_service", { uid: userId });
    }
    return { ok: false, status: 500, error: "Model үүсгэхэд алдаа гарлаа" };
  }

  const sourceImageUrl = await getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: getUploadsBucket(), Key: sourceImageKey }),
    { expiresIn: SOURCE_URL_EXPIRY_SECONDS },
  );

  try {
    const { taskId } = await submitImageToModelTask(sourceImageUrl);
    await admin.from("models").update({ status: "processing", provider_job_id: taskId }).eq("id", model.id);
  } catch (err) {
    await admin.rpc("refund_credit", {
      model_id: model.id,
      failure_reason: err instanceof Error ? err.message : "Tripo submission failed",
    });
    return { ok: false, status: 502, error: "Үүсгэлт эхлүүлэхэд алдаа гарлаа" };
  }

  return { ok: true, modelId: model.id };
}
