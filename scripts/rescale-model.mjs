// One-off admin rescale — same operation app/api/models/rescale/route.ts
// performs for a signed-in owner, run directly for a model whose owner
// can't be asked to click through the UI themselves (e.g. prepping a demo
// model ahead of time). Re-bakes both GLB and USDZ from their permanent
// `.raw.*` originals (never a previously-baked file, so repeated rescales
// can't compound floating-point drift) and points glb_url/usdz_url at the
// freshly-keyed copies — same reasoning as the webhook's own sizeModel().
//
//   node --conditions=react-server --env-file=.env.local scripts/rescale-model.mjs <modelId> <scale>
//
// Point it at production by using production env vars instead of
// .env.local (e.g. `vercel env pull .env.production.local` then
// --env-file=.env.production.local).
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { bakeGlbScale } from "../lib/glbScale.ts";
import { bakeUsdzScale } from "../lib/usdzScale.ts";
import { MODEL_CONTENT_TYPES, MODEL_CACHE_CONTROL } from "../lib/r2.ts";

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

const [, , modelId, scaleArg] = process.argv;
const scale = Number(scaleArg);
if (!modelId || !Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
  console.error(`Usage: node --conditions=react-server --env-file=.env.local scripts/rescale-model.mjs <modelId> <scale (${MIN_SCALE}-${MAX_SCALE})>`);
  process.exit(1);
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

const { data: model, error: fetchError } = await admin
  .from("models")
  .select("id, bbox_width_m, bbox_depth_m, bbox_height_m")
  .eq("id", modelId)
  .single();
if (fetchError || !model) throw new Error(`Model not found: ${fetchError?.message ?? modelId}`);

if (model.bbox_width_m != null && model.bbox_depth_m != null && model.bbox_height_m != null) {
  const w = (model.bbox_width_m * scale * 100).toFixed(1);
  const d = (model.bbox_depth_m * scale * 100).toFixed(1);
  const h = (model.bbox_height_m * scale * 100).toFixed(1);
  console.log(`Model ${modelId}: scale ${scale} -> ${w} x ${d} x ${h} cm`);
}

const rawGlbObject = await r2.send(new GetObjectCommand({ Bucket: modelsBucket, Key: `models/${modelId}.raw.glb` }));
const rawGlb = Buffer.from(await rawGlbObject.Body.transformToByteArray());
const scaledGlb = await bakeGlbScale(rawGlb, scale);
const scaledGlbKey = `models/${modelId}.${randomUUID().slice(0, 8)}.glb`;
await r2.send(
  new PutObjectCommand({
    Bucket: modelsBucket,
    Key: scaledGlbKey,
    Body: scaledGlb,
    ContentType: MODEL_CONTENT_TYPES.glb,
    CacheControl: MODEL_CACHE_CONTROL,
  }),
);
console.log(`  GLB rebaked -> ${scaledGlbKey}`);

let scaledUsdzKey;
try {
  const rawUsdzObject = await r2.send(new GetObjectCommand({ Bucket: modelsBucket, Key: `models/${modelId}.raw.usdz` }));
  const rawUsdz = Buffer.from(await rawUsdzObject.Body.transformToByteArray());
  const scaledUsdz = await bakeUsdzScale(rawUsdz, scale);
  scaledUsdzKey = `models/${modelId}.${randomUUID().slice(0, 8)}.usdz`;
  await r2.send(
    new PutObjectCommand({
      Bucket: modelsBucket,
      Key: scaledUsdzKey,
      Body: scaledUsdz,
      ContentType: MODEL_CONTENT_TYPES.usdz,
      CacheControl: MODEL_CACHE_CONTROL,
    }),
  );
  console.log(`  USDZ rebaked -> ${scaledUsdzKey}`);
} catch (err) {
  console.warn(`  USDZ rebake failed, iOS AR will keep its previous size:`, err instanceof Error ? err.message : err);
}

const { error: updateError } = await admin
  .from("models")
  .update({ scale, glb_url: scaledGlbKey, ...(scaledUsdzKey && { usdz_url: scaledUsdzKey }) })
  .eq("id", modelId);
if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

console.log("Done.");
