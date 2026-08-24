// Reads each existing model's source photo from R2 and stores its real
// pixel dimensions (migration 0012) — every row created before that
// migration is missing them, and MasonryGrid.tsx falls back to a neutral
// assumed ratio for those, which is worse than the real balance a stored
// ratio gives.
//
//   node --env-file=.env.local scripts/backfill-image-dimensions.mjs
//
// Point it at production the same way as the other backfill scripts:
// `vercel env pull .env.production.local` then --env-file that instead.
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

const admin = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SECRET_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY") },
});
const uploadsBucket = requiredEnv("R2_UPLOADS_BUCKET");

const { data: rows, error } = await admin
  .from("models")
  .select("id, source_image_key")
  .is("source_image_width", null);

if (error) throw new Error(`Query failed: ${error.message}`);

console.log(`${rows.length} model(s) missing source image dimensions.`);

let updated = 0;
let failed = 0;

for (const row of rows) {
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: uploadsBucket, Key: row.source_image_key }));
    if (!object.Body) throw new Error("source photo has no body (deleted from R2?)");
    const bytes = Buffer.from(await object.Body.transformToByteArray());

    const { width, height } = await sharp(bytes).metadata();
    if (!width || !height) throw new Error("sharp couldn't read dimensions");

    const { error: updateError } = await admin
      .from("models")
      .update({ source_image_width: width, source_image_height: height })
      .eq("id", row.id);
    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

    console.log(`  ${row.id}: ${width}x${height}`);
    updated++;
  } catch (err) {
    console.error(`  ${row.id}: FAILED —`, err instanceof Error ? err.message : err);
    failed++;
  }
}

console.log(`\nDone. ${updated} updated, ${failed} failed.`);
