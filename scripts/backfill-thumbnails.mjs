// Renders lib/renderThumbnail.ts's studio thumbnail for every `ready` model
// that doesn't have one yet — costs no Tripo credits, the GLB is already in
// R2 (see CLAUDE.md, the thumbnail-render feature's own backfill note).
//
// lib/renderThumbnail.ts imports "server-only", which throws when required
// directly by plain node (see node_modules/server-only/index.js) — its
// package.json's "react-server" export condition is what redirects that to
// a no-op instead, so this MUST run with --conditions=react-server:
//
//   node --conditions=react-server --env-file=.env.local scripts/backfill-thumbnails.mjs
//
// Point it at production by using production env vars instead of
// .env.local (e.g. `vercel env pull .env.production.local` then
// --env-file=.env.production.local).
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { renderThumbnail } from "../lib/renderThumbnail.ts";
import { MODEL_CONTENT_TYPES, MODEL_CACHE_CONTROL } from "../lib/r2.ts";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = requiredEnv("SUPABASE_SECRET_KEY");
const admin = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  },
});
const modelsBucket = requiredEnv("R2_MODELS_BUCKET");

const { data: rows, error } = await admin
  .from("models")
  .select("id, glb_url, bbox_width_m, bbox_depth_m, bbox_height_m")
  .eq("status", "ready")
  .is("render_url", null)
  .not("glb_url", "is", null);

if (error) throw new Error(`Query failed: ${error.message}`);

console.log(`${rows.length} ready model(s) missing a render.`);

let rendered = 0;
let skippedNoBbox = 0;
let failed = 0;

for (const row of rows) {
  if (row.bbox_width_m == null || row.bbox_depth_m == null || row.bbox_height_m == null) {
    // Same gate the webhook itself uses — no bbox, no camera-fit math, no
    // render. Pre-migration-0008 rows only.
    console.log(`  ${row.id}: skipped, no bbox stored`);
    skippedNoBbox++;
    continue;
  }

  try {
    const glbObject = await r2.send(new GetObjectCommand({ Bucket: modelsBucket, Key: row.glb_url }));
    const glb = Buffer.from(await glbObject.Body.transformToByteArray());

    const bbox = { width: row.bbox_width_m, depth: row.bbox_depth_m, height: row.bbox_height_m };
    const result = await renderThumbnail({ glb, bbox, modelId: row.id });

    const renderKey = `models/${row.id}.webp`;
    await r2.send(
      new PutObjectCommand({
        Bucket: modelsBucket,
        Key: renderKey,
        Body: result.image,
        ContentType: MODEL_CONTENT_TYPES.webp,
        CacheControl: MODEL_CACHE_CONTROL,
      }),
    );

    const { error: updateError } = await admin.from("models").update({ render_url: renderKey }).eq("id", row.id);
    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    console.log(`  ${row.id}: rendered (${result.width}x${result.height}, ${result.image.length} bytes)`);
    rendered++;
  } catch (err) {
    console.error(`  ${row.id}: FAILED —`, err instanceof Error ? err.message : err);
    failed++;
  }
}

console.log(`\nDone. ${rendered} rendered, ${skippedNoBbox} skipped (no bbox), ${failed} failed.`);
