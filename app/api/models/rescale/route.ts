import { NextResponse } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Client, getModelsBucket, MODEL_CONTENT_TYPES, MODEL_CACHE_CONTROL } from "@/lib/r2";
import { bakeGlbScale } from "@/lib/glbScale";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;

/**
 * Not app/api/models/[id]/route.ts — same reason as models/delete/route.ts:
 * app/api/models/[...key]/route.ts already owns the first dynamic segment
 * under app/api/models/, and Next.js rejects a second, differently-named
 * dynamic segment at that position. A static "rescale" folder coexists with
 * the catch-all fine, so id travels in the request body instead.
 *
 * hooks/useModelScale.ts used to write `scale` straight from the browser's
 * own session client — safe for the DB column alone (migration 0004 grants
 * `authenticated` UPDATE on it), but scale only ever affected the number in
 * the DB, never the model's actual geometry, because <model-viewer>'s
 * `scale` attribute is a no-op in the installed version (lib/glbScale.ts's
 * header explains why) on-page AND in AR. Making scale real requires
 * re-baking the GLB, which needs R2 (service-role-only, rule 34's list) and
 * a write to `glb_url` (also service-role-only) — a browser client can't do
 * either, hence this route. Ownership is verified explicitly here (rule 30:
 * proxy.ts is not a boundary, and the admin client below bypasses RLS
 * entirely, so this check is the only gate that exists once past it).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = body?.id;
  const scale = Number(body?.scale);

  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid or missing id" }, { status: 400 });
  }
  if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
    return NextResponse.json({ error: `scale must be between ${MIN_SCALE} and ${MAX_SCALE}` }, { status: 400 });
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
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!model) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const r2 = getR2Client();
  const bucket = getModelsBucket();

  let rawGlb: Buffer;
  try {
    const rawObject = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: `models/${id}.raw.glb` }));
    if (!rawObject.Body) throw new Error("raw GLB has no body");
    rawGlb = Buffer.from(await rawObject.Body.transformToByteArray());
  } catch (err) {
    console.error(`Rescale model ${id}: failed to read raw GLB`, err);
    return NextResponse.json({ error: "Model has no raw GLB to re-scale from" }, { status: 500 });
  }

  let scaledKey: string;
  try {
    const scaledGlb = await bakeGlbScale(rawGlb, scale);
    scaledKey = `models/${id}.${randomUUID().slice(0, 8)}.glb`;
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: scaledKey,
        Body: scaledGlb,
        ContentType: MODEL_CONTENT_TYPES.glb,
        CacheControl: MODEL_CACHE_CONTROL,
      }),
    );
  } catch (err) {
    console.error(`Rescale model ${id}: bake/upload failed`, err);
    return NextResponse.json({ error: "Failed to apply scale" }, { status: 500 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("models").update({ scale, glb_url: scaledKey }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to save scale" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, glbKey: scaledKey });
}
