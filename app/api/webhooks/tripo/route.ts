import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Client, getModelsBucket, MODEL_CONTENT_TYPES, MODEL_CACHE_CONTROL } from "@/lib/r2";
import { verifyTripoWebhookSignature, getWebhookSecret, submitUsdzConversionTask, type TripoTask } from "@/lib/tripo";

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
    const parsed = JSON.parse(rawBody) as { data?: TripoTask };
    if (!parsed?.data?.task_id || !parsed.data.status) throw new Error("missing data.task_id/status");
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
  const fileBytes = Buffer.from(await fileRes.arrayBuffer());

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
      .update({ glb_url: key })
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
