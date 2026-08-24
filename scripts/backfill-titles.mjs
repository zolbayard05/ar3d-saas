// Names every `ready` model that's still untitled (title IS NULL), using
// the same Gemini call the webhook now runs automatically for new models —
// see app/api/webhooks/tripo/route.ts's nameModel() and lib/gemini.ts.
//
// lib/gemini.ts imports "server-only", which throws when required directly
// by plain node — its package.json's "react-server" export condition is
// what redirects that to a no-op instead, so this MUST run with
// --conditions=react-server (same requirement as backfill-thumbnails.mjs):
//
//   node --conditions=react-server --env-file=.env.local scripts/backfill-titles.mjs
//
// Point it at production by using production env vars instead of
// .env.local (e.g. `vercel env pull .env.production.local` then
// --env-file=.env.production.local).
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { generateModelTitle } from "../lib/gemini.ts";

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
const uploadsBucket = requiredEnv("R2_UPLOADS_BUCKET");

const UPLOAD_MIME_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

const { data: rows, error } = await admin
  .from("models")
  .select("id, source_image_key")
  .eq("status", "ready")
  .is("title", null);

if (error) throw new Error(`Query failed: ${error.message}`);

console.log(`${rows.length} ready model(s) missing a title.`);

let named = 0;
let failed = 0;

for (const row of rows) {
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: uploadsBucket, Key: row.source_image_key }));
    if (!object.Body) throw new Error("source photo has no body (deleted from R2?)");
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    const ext = row.source_image_key.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = object.ContentType || UPLOAD_MIME_TYPES[ext] || "image/jpeg";

    const title = await generateModelTitle(bytes, mimeType);

    const { error: updateError, data: updated } = await admin
      .from("models")
      .update({ title })
      .eq("id", row.id)
      .is("title", null)
      .select("id");
    if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
    if (!updated || updated.length === 0) {
      console.log(`  ${row.id}: skipped, already named (race with something else)`);
      continue;
    }

    console.log(`  ${row.id}: "${title}"`);
    named++;
  } catch (err) {
    console.error(`  ${row.id}: FAILED —`, err instanceof Error ? err.message : err);
    failed++;
  }
}

console.log(`\nDone. ${named} named, ${failed} failed.`);
