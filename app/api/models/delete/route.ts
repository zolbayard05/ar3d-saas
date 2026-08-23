import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, getModelsBucket, getUploadsBucket } from "@/lib/r2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Not app/api/models/[id]/route.ts — app/api/models/[...key]/route.ts (the
 * public GLB/USDZ/thumbnail proxy, rule 6) already owns the first dynamic
 * segment under app/api/models/, and Next.js rejects two differently-named
 * dynamic segments at the same path position. A static "delete" folder
 * coexists with that catch-all fine (Next.js matches static segments before
 * catch-alls), so the id travels as a query param instead of a path segment.
 *
 * No new RLS policy or grant needed here — "models: owner delete" (migration
 * 0001) and authenticated's table-level DELETE grant (Supabase's default,
 * never revoked by 0004/0005/0009, confirmed via information_schema before
 * writing this) already cover it. This route exists only because deleting
 * the R2 objects needs service credentials a browser client doesn't have —
 * the DB delete itself goes through the request-scoped client below, so RLS
 * still double-checks ownership even though `.eq("user_id", user.id)` also
 * checks it explicitly (rule 30: never rely on one gate alone).
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid or missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: model } = await supabase
    .from("models")
    .select("source_image_key, glb_url, usdz_url, render_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // A retry submits the SAME source_image_key on a new row (HomeFeed's
  // handleRetry) — the original failed row and its retry both point at one
  // photo. Deleting that photo out from under a still-live sibling row
  // would break that row's own "original photo" link and, if it's still
  // pending/processing, the in-flight Tripo fetch itself. Only delete the
  // source photo when nothing else references it.
  const { count: sharedSourceCount } = await supabase
    .from("models")
    .select("id", { count: "exact", head: true })
    .eq("source_image_key", model.source_image_key)
    .neq("id", id);

  const r2 = getR2Client();
  const modelsBucket = getModelsBucket();
  const deletes: Promise<unknown>[] = [];

  if (model.glb_url) {
    deletes.push(r2.send(new DeleteObjectCommand({ Bucket: modelsBucket, Key: model.glb_url })));
  }
  if (model.usdz_url) {
    deletes.push(r2.send(new DeleteObjectCommand({ Bucket: modelsBucket, Key: model.usdz_url })));
  }
  if (model.render_url) {
    deletes.push(r2.send(new DeleteObjectCommand({ Bucket: modelsBucket, Key: model.render_url })));
  }
  if (!sharedSourceCount) {
    deletes.push(
      r2.send(new DeleteObjectCommand({ Bucket: getUploadsBucket(), Key: model.source_image_key })),
    );
  }

  // Best-effort: an R2 hiccup shouldn't leave the user stuck unable to
  // remove a row they explicitly asked to delete. Failures are logged, not
  // swallowed silently, so a real leak (as opposed to a transient blip)
  // shows up in the same place other per-model warnings already do (rules
  // 21/24's logging pattern) rather than nowhere.
  const results = await Promise.allSettled(deletes);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn(`Delete model ${id}: R2 object cleanup failed`, result.reason);
    }
  }

  const { error: deleteError } = await supabase
    .from("models")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete model" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
