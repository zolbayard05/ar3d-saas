// Creates a `ready` models row pointing at a GLB/USDZ pair you've already
// uploaded to the `models` bucket by hand — Phase 4's way of testing the AR
// viewer without a Tripo key (see README "Generation pipeline"). Insert goes
// through service_role directly since migration 0005 made that the only
// legitimate way to create a models row (rule 35).
//
// Usage:
//   node --env-file=.env.local scripts/seed-test-model.mjs \
//     --email you@example.com --glb models/test.glb --usdz models/test.usdz
//
// Upload the pair first, e.g. via the Cloudflare dashboard's R2 object
// browser, or `aws s3 cp --endpoint-url ...` — this script only wires the DB
// row, it doesn't upload anything.
import { createClient } from "@supabase/supabase-js";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

const args = parseArgs();
const { email, "user-id": userId, glb, usdz, scale = "1", title = "Test model" } = args;

if ((!email && !userId) || !glb || !usdz) {
  console.error(
    "Usage: node --env-file=.env.local scripts/seed-test-model.mjs --email you@example.com --glb models/test.glb --usdz models/test.usdz [--scale 1] [--title \"Test model\"]",
  );
  console.error("(or --user-id <uuid> instead of --email)");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

let resolvedUserId = userId;
if (!resolvedUserId) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  const match = data.users.find((u) => u.email === email);
  if (!match) throw new Error(`No user found with email ${email}`);
  resolvedUserId = match.id;
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const modelsBucket = process.env.R2_MODELS_BUCKET;

for (const key of [glb, usdz]) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: modelsBucket, Key: key }));
  } catch {
    console.error(
      `Object not found at models/${key} in bucket "${modelsBucket}" — upload it first (this script only wires the DB row).`,
    );
    process.exit(1);
  }
}

const { data: model, error } = await admin
  .from("models")
  .insert({
    user_id: resolvedUserId,
    title,
    status: "ready",
    source_image_key: "manual/seed",
    provider: "manual-seed",
    glb_url: glb,
    usdz_url: usdz,
    scale: Number(scale),
  })
  .select("id")
  .single();

if (error) throw new Error(`insert failed: ${error.message}`);

console.log(`Seeded model ${model.id} for user ${resolvedUserId}`);
console.log(`View it at: http://localhost:3000/models/${model.id}`);
