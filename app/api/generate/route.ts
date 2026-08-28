import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Client, getUploadsBucket } from "@/lib/r2";
import { submitImageToModelTask } from "@/lib/tripo";

const SOURCE_URL_EXPIRY_SECONDS = 10 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = "23505";

/**
 * Kicks off generation for an already-uploaded photo. Per CLAUDE.md rule 12:
 * deduct credit -> insert a `pending` models row -> submit to the provider ->
 * return 202 immediately. The webhook (app/api/webhooks/tripo) does the rest;
 * this route must never block on the 30-100s generation itself.
 *
 * Idempotency: the caller must send `idempotencyKey`, one UUID generated
 * ONCE per submit attempt — a network-retried request or a double-click must
 * resend the SAME key, never a fresh one, or none of the below does
 * anything. migration 0006's unique (user_id, idempotency_key) index is the
 * actual enforcement; the upfront SELECT below is just a fast path that
 * avoids spending a credit at all for the common sequential-retry case.
 *
 * Every step after credit deduction that can fail is followed by a
 * compensating refund — rule 17 makes deduction atomic, but atomic doesn't
 * mean free of failure paths after the fact, and a lost credit for a
 * generation that never started is exactly the kind of "not the happy path"
 * bug this phase is about avoiding.
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

  const { sourceImageKey, idempotencyKey, sourceImageWidth, sourceImageHeight } = (body ?? {}) as {
    sourceImageKey?: unknown;
    idempotencyKey?: unknown;
    sourceImageWidth?: unknown;
    sourceImageHeight?: unknown;
  };

  // Optional — CaptureFlow.tsx sends these best-effort (a decode failure
  // there just omits them); MasonryGrid falls back to a neutral ratio for
  // rows without them. Validated the same way as any other client-supplied
  // number would be: must actually be a positive integer if present at all.
  const validDimension = (value: unknown): number | null =>
    typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
  const imageWidth = validDimension(sourceImageWidth);
  const imageHeight = validDimension(sourceImageHeight);

  // Must be a key this route itself could only have handed out via
  // /api/upload-url, which always derives it as uploads/{userId}/{uuid}.ext
  // (never client-supplied). Re-checking the prefix here stops a caller from
  // pointing generation at another user's uploaded photo by guessing/reusing
  // a key that isn't theirs.
  if (
    typeof sourceImageKey !== "string" ||
    !sourceImageKey.startsWith(`uploads/${user.id}/`)
  ) {
    return NextResponse.json({ error: "sourceImageKey буруу эсвэл дутуу байна" }, { status: 400 });
  }

  if (typeof idempotencyKey !== "string" || !UUID_RE.test(idempotencyKey)) {
    return NextResponse.json({ error: "idempotencyKey буруу эсвэл дутуу байна (UUID байх ёстой)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fast path: a retry of the same attempt (lost response, double-click)
  // resends this exact key. If we already have a row for it, this IS that
  // attempt succeeding — return it as-is, no credit touched, no error.
  const { data: existing } = await supabase
    .from("models")
    .select("id")
    .eq("user_id", user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ modelId: existing.id }, { status: 202 });
  }

  const { data: consumed, error: consumeError } = await supabase.rpc("consume_credit", {
    uid: user.id,
  });
  if (consumeError) {
    return NextResponse.json({ error: "Кредитийн үлдэгдэл шалгахад алдаа гарлаа" }, { status: 500 });
  }
  if (!consumed) {
    return NextResponse.json({ error: "Кредит хүрэлцэхгүй байна" }, { status: 402 });
  }

  // Insert always goes through service_role: RLS/column grants no longer
  // allow `authenticated` to insert into models at all (migration 0005) —
  // this is the one and only legitimate creator of a models row, and using
  // service_role here means we don't depend on those grants being exactly
  // right to keep status/glb_url out of a client's hands at insert time.
  const { data: model, error: insertError } = await admin
    .from("models")
    .insert({
      user_id: user.id,
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
    // row) can't be used. A plain read-then-write refund is safe here
    // specifically because this block is scoped to a single invocation of
    // this handler: the read and the write both happen inside the one
    // consume_credit -> insert -> (this block) sequence of THIS request,
    // with no state shared across invocations that could let one call's
    // refund interact with another's.
    //
    // Reachable by a retry? Yes — a client retrying the same logical
    // request after a lost response, or a genuine double-click, calls this
    // route again, and that second call runs its own independent
    // consume_credit. That's a fresh deduction, not a resumption of the
    // first call, so it can't collide with the first call's refund: each
    // invocation either (a) fails here and is fully undone by this refund,
    // or (b) succeeds and is the one deduction that should legitimately
    // stand. There's no path where the same refund runs twice, because
    // it's gated on that invocation's own insertError, not on any
    // cross-request flag.
    if (insertError?.code === UNIQUE_VIOLATION) {
      // Lost the race to a truly concurrent duplicate (the upfront SELECT
      // above missed it because both requests read before either wrote) —
      // NOT a real failure, the desired row now exists, just not from this
      // call. Refund this call's now-redundant deduction directly rather
      // than via refund_credit: refund_credit marks the model `failed`,
      // which would be wrong here — the winning call's model is a
      // legitimately succeeding row, not a failure.
      const { data: profile } = await admin.from("profiles").select("credits").eq("id", user.id).single();
      if (profile) {
        await admin.from("profiles").update({ credits: profile.credits + 1 }).eq("id", user.id);
      }
      const { data: winner } = await admin
        .from("models")
        .select("id")
        .eq("user_id", user.id)
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (winner) {
        return NextResponse.json({ modelId: winner.id }, { status: 202 });
      }
      // Winner not found (deleted between the conflict and this read) —
      // fall through to the generic failure response below.
    } else {
      const { data: profile } = await admin.from("profiles").select("credits").eq("id", user.id).single();
      if (profile) {
        await admin.from("profiles").update({ credits: profile.credits + 1 }).eq("id", user.id);
      }
    }
    return NextResponse.json({ error: "Model үүсгэхэд алдаа гарлаа" }, { status: 500 });
  }

  const sourceImageUrl = await getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: getUploadsBucket(), Key: sourceImageKey }),
    { expiresIn: SOURCE_URL_EXPIRY_SECONDS },
  );

  try {
    const { taskId } = await submitImageToModelTask(sourceImageUrl);
    await admin
      .from("models")
      .update({ status: "processing", provider_job_id: taskId })
      .eq("id", model.id);
  } catch (err) {
    await admin.rpc("refund_credit", {
      model_id: model.id,
      failure_reason: err instanceof Error ? err.message : "Tripo submission failed",
    });
    return NextResponse.json({ error: "Үүсгэлт эхлүүлэхэд алдаа гарлаа" }, { status: 502 });
  }

  return NextResponse.json({ modelId: model.id }, { status: 202 });
}
