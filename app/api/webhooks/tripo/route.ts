import { NextResponse } from "next/server";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Client, getModelsBucket, getUploadsBucket, MODEL_CONTENT_TYPES, MODEL_CACHE_CONTROL } from "@/lib/r2";
import {
  verifyTripoWebhookSignature,
  getWebhookSecret,
  submitUsdzConversionTask,
  submitImageToModelTask,
  faceLimitForAttempt,
  TARGET_USDZ_BYTES,
  MAX_SIZE_RETRIES,
  type TripoTask,
} from "@/lib/tripo";
import { compressGlb, validateGlb } from "@/lib/glbCompress";

const SOURCE_URL_EXPIRY_SECONDS = 10 * 60;

type Stage = "glb" | "usdz";

/**
 * Tripo delivers two independent completion events per model here (see
 * lib/tripo.ts): the image-to-model task (produces GLB) and, kicked off
 * from this handler once that succeeds, a convert-to-USDZ task. Both land
 * on this one endpoint; `provider_job_id` / `usdz_provider_job_id` on the
 * models row is how an incoming task_id gets matched back to a stage.
 *
 * CLAUDE.md rule 13's ordering is load-bearing: verify signature, THEN
 * download+re-upload the provider's files to R2, and ONLY THEN flip the DB
 * row toward ready — marking ready before the files actually exist in R2
 * means a client's <model-viewer> 404s.
 *
 * Rule 16: idempotent on the state transition, not on receipt. Every write
 * below is guarded so a duplicate delivery (Tripo retries) is a no-op, never
 * a second refund or a second R2 write racing a first.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("tripo-webhook-signature");

  if (!verifyTripoWebhookSignature(rawBody, signature, getWebhookSecret())) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let task: TripoTask;
  try {
    const parsed = JSON.parse(rawBody) as { data?: TripoTask; type?: string };

    // Tripo posts every account-level event type to this same webhook URL,
    // not just task completions (observed live: "balance.low", whose data
    // has a task_id — coincidentally the id of an in-flight task — but no
    // status). Only a task-status event has `data.status`; anything else is
    // a real, expected delivery we don't act on. Same rationale as the
    // unmatched-task_id branch below: ack 200, don't 400, or Tripo retries
    // a delivery that will never resolve to anything.
    if (!parsed?.data?.status) {
      console.info(`Tripo webhook: ignoring non-task-status event type=${parsed?.type ?? "unknown"}`);
      return NextResponse.json({ ok: true, note: `ignored event type=${parsed?.type ?? "unknown"}` });
    }
    if (!parsed.data.task_id) throw new Error("missing data.task_id");
    task = parsed.data;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const admin = createAdminClient();

  const [glbMatch, usdzMatch] = await Promise.all([
    admin.from("models").select("*").eq("provider_job_id", task.task_id).maybeSingle(),
    admin.from("models").select("*").eq("usdz_provider_job_id", task.task_id).maybeSingle(),
  ]);

  const stage: Stage | null = glbMatch.data ? "glb" : usdzMatch.data ? "usdz" : null;
  const model = glbMatch.data ?? usdzMatch.data;

  if (!stage || !model) {
    // Unrecognized task_id — not a model we know about (stale env, a task
    // from a different project, etc). Ack anyway: returning non-200 only
    // makes Tripo retry a delivery that will never resolve to anything.
    console.warn(`Tripo webhook: no model matches task_id=${task.task_id}`);
    return NextResponse.json({ ok: true });
  }

  // Idempotency guard — the actual source of truth. task.status is trusted
  // provider input, but "have we already acted on this stage" is ours to
  // decide from our own row, not from receiving an event.
  if (stage === "glb" && (model.status === "ready" || model.status === "failed" || model.glb_url !== null)) {
    return NextResponse.json({ ok: true, note: "already processed" });
  }
  if (stage === "usdz" && (model.status === "ready" || model.status === "failed" || model.usdz_url !== null)) {
    return NextResponse.json({ ok: true, note: "already processed" });
  }

  if (task.status === "failed" || task.status === "cancelled") {
    // A USDZ-stage failure means the model has a GLB but not a USDZ — rule 1
    // requires both, so this is not a partial success; treat it the same as
    // a GLB-stage failure and refund. refund_credit's own WHERE clause
    // (status <> 'failed') makes this idempotent against a duplicate
    // delivery of the same failure event.
    await admin.rpc("refund_credit", {
      model_id: model.id,
      failure_reason: task.error_message || `Tripo ${stage} task ${task.status}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (task.status !== "success") {
    // Terminal-only delivery is documented Tripo behavior, so a
    // queued/running event landing here would be unexpected — ack without
    // acting rather than erroring, since there's nothing wrong to report.
    return NextResponse.json({ ok: true, note: `no-op for status=${task.status}` });
  }

  const modelUrl = task.output?.model_url;
  if (!modelUrl) {
    await admin.rpc("refund_credit", {
      model_id: model.id,
      failure_reason: `Tripo ${stage} task reported success with no output.model_url`,
    });
    return NextResponse.json({ ok: true });
  }

  const fileRes = await fetch(modelUrl);
  if (!fileRes.ok) {
    await admin.rpc("refund_credit", {
      model_id: model.id,
      failure_reason: `Failed to download Tripo ${stage} output: HTTP ${fileRes.status}`,
    });
    return NextResponse.json({ ok: true });
  }
  let fileBytes = Buffer.from(await fileRes.arrayBuffer());

  // Rule 21: Draco-compress + cap textures at 2K on the GLB specifically.
  // Not applicable to USDZ — KHR_draco_mesh_compression is a glTF-only
  // extension, ARKit's format has no equivalent (see lib/glbCompress.ts).
  // Compression failure shouldn't lose the generation entirely: fall back to
  // the uncompressed file rather than refunding over a post-process step.
  let bbox: { width: number; depth: number; height: number } | undefined;
  if (stage === "glb") {
    try {
      const result = await compressGlb(fileBytes);
      fileBytes = Buffer.from(result.glb);
      bbox = result.bbox;
      if (result.seamGap) {
        // Visibility into the frequency-separation quality pass itself, not
        // just whether it ran: if this technique quietly stops helping on
        // some object/material type, this is where that shows up in data
        // rather than being discovered by a user first.
        console.info(
          `Tripo webhook: model ${model.id} seam luminance gap (P99, low-freq layer) ${result.seamGap.before.toFixed(1)} -> ${result.seamGap.after.toFixed(1)}`,
        );
      }
    } catch (err) {
      console.warn(
        `Tripo webhook: GLB compression failed for model ${model.id}, storing uncompressed`,
        err,
      );
    }

    // Gate before anything is uploaded or the USDZ conversion (another paid
    // Tripo task) is even kicked off: a model that can't parse, has no real
    // geometry, or has implausible proportions shouldn't reach a user as
    // "ready" and shouldn't cost a credit — see lib/glbCompress.ts's
    // validateGlb. Runs on `fileBytes` as it stands right now (compressed,
    // or the raw fallback above if compression itself failed) — whichever
    // one we'd actually be shipping.
    const validation = await validateGlb(fileBytes);

    // Logged unconditionally, pass or fail — MAX_ASPECT_RATIO in
    // lib/glbCompress.ts is currently sized to catch one sample (the
    // "512x512" placeholder case). This is the data that turns it into a
    // measured threshold instead of a guess: without the passing values too,
    // there's no distribution to compare a rejection against, only the one
    // failure that prompted picking 10 in the first place.
    if (validation.aspectRatio !== undefined) {
      console.info(
        `Tripo webhook: model ${model.id} GLB aspect ratio ${validation.aspectRatio.toFixed(2)}:1 (${validation.valid ? "passed" : "REJECTED"})`,
      );
    }

    if (!validation.valid) {
      console.warn(`Tripo webhook: model ${model.id} failed GLB validation: ${validation.reason}`);
      await admin.rpc("refund_credit", {
        model_id: model.id,
        failure_reason: `Model failed validation: ${validation.reason}`,
      });
      return NextResponse.json({ ok: true, note: "failed validation" });
    }
  }

  // Rule 21's size budget, enforced (not just hoped for): USDZ can't be
  // Draco-compressed after the fact (see lib/glbCompress.ts), so geometry
  // complexity at generation time is the only lever — an oversized result
  // here means the *generation itself* has to be retried at a lower
  // face_limit, not a local re-process. Bounded to MAX_SIZE_RETRIES: this
  // costs a full new Tripo generation per attempt, not a cheap step.
  if (stage === "usdz" && fileBytes.length > TARGET_USDZ_BYTES && model.size_retry_count < MAX_SIZE_RETRIES) {
    const attemptedFaceLimit = faceLimitForAttempt(model.size_retry_count);
    const nextAttempt = model.size_retry_count + 1;
    const nextFaceLimit = faceLimitForAttempt(nextAttempt);
    console.warn(
      `Tripo webhook: model ${model.id} USDZ ${(fileBytes.length / (1024 * 1024)).toFixed(2)} MB ` +
        `exceeds ${(TARGET_USDZ_BYTES / (1024 * 1024)).toFixed(0)} MB target at face_limit=${attemptedFaceLimit} ` +
        `(attempt ${model.size_retry_count}) — retrying at face_limit=${nextFaceLimit} (attempt ${nextAttempt})`,
    );

    const sourceImageUrl = await getSignedUrl(
      getR2Client(),
      new GetObjectCommand({ Bucket: getUploadsBucket(), Key: model.source_image_key }),
      { expiresIn: SOURCE_URL_EXPIRY_SECONDS },
    );

    try {
      const { taskId: newTaskId } = await submitImageToModelTask(sourceImageUrl, nextFaceLimit);
      const { data: updated } = await admin
        .from("models")
        .update({
          status: "processing",
          glb_url: null,
          usdz_url: null,
          provider_job_id: newTaskId,
          usdz_provider_job_id: null,
          size_retry_count: nextAttempt,
        })
        .eq("id", model.id)
        .is("usdz_url", null)
        .select("id");

      if (!updated || updated.length === 0) {
        // Lost the race to a concurrent duplicate delivery already driving
        // this — don't submit a second retry generation on top of it.
        return NextResponse.json({ ok: true, note: "concurrent delivery already handled" });
      }
      return NextResponse.json({ ok: true, note: `size retry submitted (attempt ${nextAttempt})` });
    } catch (err) {
      // Resubmission failed — don't strand the model row on a discarded
      // oversized file. Fall through (past this whole if-block) and ship
      // what we have instead; it's oversized but still a valid, deliverable
      // model (rule: never fail a paid generation over a size-budget retry).
      console.warn(`Tripo webhook: model ${model.id} size-retry resubmission failed, shipping oversized result instead`, err);
    }
  }

  if (stage === "usdz") {
    // Final size, logged either way — this is the data set rule 21's
    // DEFAULT_FACE_LIMIT guess needs to become a measured value instead of
    // a guess, after enough real objects have gone through this.
    const withinTarget = fileBytes.length <= TARGET_USDZ_BYTES;
    console.info(
      `Tripo webhook: model ${model.id} final USDZ ${(fileBytes.length / (1024 * 1024)).toFixed(2)} MB ` +
        `(face_limit=${faceLimitForAttempt(model.size_retry_count)}, attempt ${model.size_retry_count}, ` +
        `${withinTarget ? "within" : "OVER"} ${(TARGET_USDZ_BYTES / (1024 * 1024)).toFixed(0)} MB target)`,
    );
  }

  // Stored as the bare R2 key, not a full URL: NEXT_PUBLIC_MODELS_CDN_URL
  // isn't live yet (see README — Phase 4 is blocked on a production
  // domain), so there is no real URL to write. Writing one anyway would
  // mean either a broken link now or a backfill migration later; storing
  // the key means Phase 4 just prefixes NEXT_PUBLIC_MODELS_CDN_URL at
  // render time and nothing here needs to change once the domain exists.
  const key = `models/${model.id}.${stage}`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getModelsBucket(),
      Key: key,
      Body: fileBytes,
      ContentType: MODEL_CONTENT_TYPES[stage],
      CacheControl: MODEL_CACHE_CONTROL,
    }),
  );

  if (stage === "glb") {
    const { data: updated } = await admin
      .from("models")
      .update({
        glb_url: key,
        ...(bbox && { bbox_width_m: bbox.width, bbox_depth_m: bbox.depth, bbox_height_m: bbox.height }),
      })
      .eq("id", model.id)
      .is("glb_url", null)
      .select("id");

    if (!updated || updated.length === 0) {
      // Lost the race to a concurrent duplicate delivery that already set
      // glb_url — the other delivery is already driving the USDZ stage.
      return NextResponse.json({ ok: true, note: "concurrent delivery already handled" });
    }

    try {
      const { taskId: usdzTaskId } = await submitUsdzConversionTask(task.task_id);
      await admin.from("models").update({ usdz_provider_job_id: usdzTaskId }).eq("id", model.id);
    } catch (err) {
      await admin.rpc("refund_credit", {
        model_id: model.id,
        failure_reason: err instanceof Error ? err.message : "Failed to start USDZ conversion",
      });
    }
    return NextResponse.json({ ok: true });
  }

  // stage === "usdz": this is the last step — flip to ready atomically with
  // the write, guarded the same way as the GLB branch above.
  await admin
    .from("models")
    .update({ usdz_url: key, status: "ready" })
    .eq("id", model.id)
    .is("usdz_url", null);

  return NextResponse.json({ ok: true });
}
