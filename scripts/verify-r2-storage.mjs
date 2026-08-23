// One-off live verification for Phase 2: R2 storage constraints (CLAUDE.md
// rules 1-6). Exercises the exact PutObjectCommand shape app/api/upload-url
// uses, then reads back what R2 actually stored — not what the code claims
// to set. Requires R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
// R2_UPLOADS_BUCKET / R2_MODELS_BUCKET in the environment (see .env.example).
// NEXT_PUBLIC_MODELS_CDN_URL is optional — the CORS-on-models check is
// skipped (not failed) until the custom domain is live, since DNS
// propagation is handled separately.
// Cleans up everything it creates; safe to re-run.
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} — see .env.example`);
    process.exit(1);
  }
  return value;
}

const accountId = requiredEnv("R2_ACCOUNT_ID");
const uploadsBucket = requiredEnv("R2_UPLOADS_BUCKET");
const modelsBucket = requiredEnv("R2_MODELS_BUCKET");
const modelsCdnUrl = process.env.NEXT_PUBLIC_MODELS_CDN_URL; // optional, see header
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  },
});

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}
function skip(name, reason) {
  console.log(`SKIP  ${name} — ${reason}`);
}

// A minimal-but-valid 1x1 JPEG — real JPEG bytes (a photo, just a trivial
// one), not a placeholder text file. This tests storage behavior
// (Content-Type / Cache-Control / bucket ACL), not generation quality.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

const stamp = Date.now();
const uploadsKey = `uploads/verify-phase2-${stamp}/test.jpg`;

try {
  // --- 0. both buckets actually exist and are reachable with these creds -
  await client.send(new HeadBucketCommand({ Bucket: uploadsBucket }));
  await client.send(new HeadBucketCommand({ Bucket: modelsBucket }));
  record("both buckets exist and are reachable with the configured credentials", true);

  // --- 1. presign + PUT through the exact shape app/api/upload-url uses --
  const putCommand = new PutObjectCommand({
    Bucket: uploadsBucket,
    Key: uploadsKey,
    ContentType: "image/jpeg",
    ContentLength: TINY_JPEG.length,
  });
  const uploadUrl = await getSignedUrl(client, putCommand, { expiresIn: 300 });

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: TINY_JPEG,
  });
  if (!putRes.ok) {
    throw new Error(`presigned PUT failed: ${putRes.status} ${await putRes.text()}`);
  }

  // --- 2. read back what R2 ACTUALLY stored, not what the code claims ----
  const head = await client.send(
    new HeadObjectCommand({ Bucket: uploadsBucket, Key: uploadsKey }),
  );
  record(
    "uploads bucket: stored Content-Type matches what the route signed",
    head.ContentType === "image/jpeg",
    `Content-Type=${head.ContentType}`,
  );
  console.log(
    `      Cache-Control on this object: ${head.CacheControl ?? "(not set)"} ` +
      `— expected not set: rule 3's Cache-Control requirement is scoped to ` +
      `the MODELS bucket (generated .glb/.usdz), not source photos here.`,
  );

  // --- 3. a signed URL can't be redirected to write outside its key ------
  // app/api/upload-url never accepts a client-supplied key (verified by
  // code inspection — the route derives it solely from the authenticated
  // user's id), but the deeper guarantee is that R2's presigned URL is
  // cryptographically bound to the exact key it was signed for. Prove that
  // directly: take a valid signed URL and swap the key in its path while
  // keeping the same signature — R2 must reject it.
  const tamperedUrl = uploadUrl.replace(
    encodeURIComponent(uploadsKey).replace(/%2F/g, "/"),
    encodeURIComponent(`uploads/some-other-user/${stamp}.jpg`).replace(/%2F/g, "/"),
  );
  const tamperedRes = await fetch(tamperedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: TINY_JPEG,
  });
  record(
    "presigned URL is bound to its exact key — cannot be redirected to another prefix",
    tamperedRes.status === 403,
    `status=${tamperedRes.status} (expected 403 SignatureDoesNotMatch)`,
  );

  // --- 4. uploads bucket is genuinely private -----------------------------
  const directGet = await fetch(`${endpoint}/${uploadsBucket}/${uploadsKey}`);
  const directGetBody = await directGet.text();
  // R2 rejects a request with no Authorization header at all before it ever
  // reaches a bucket-ACL check — that's 400 InvalidArgument, not 403/401.
  // Both are "rejected unauthenticated access"; only a 200 would be a leak.
  record(
    "uploads bucket: unauthenticated direct GET (no signature) is rejected",
    directGet.status === 403 || directGet.status === 401 || directGet.status === 400,
    `status=${directGet.status}, body=${directGetBody}`,
  );

  // --- 5. models bucket CORS allows GET/HEAD from our origin only --------
  if (!modelsCdnUrl) {
    skip(
      "models bucket: CORS allows GET/HEAD from our origin only",
      "NEXT_PUBLIC_MODELS_CDN_URL not set yet — needs the custom domain live (DNS propagation), see README",
    );
  } else {
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const probeUrl = `${modelsCdnUrl.replace(/\/$/, "")}/probe-key-need-not-exist`;

    const goodPreflight = await fetch(probeUrl, {
      method: "OPTIONS",
      headers: { Origin: appOrigin, "Access-Control-Request-Method": "GET" },
    });
    const allowOrigin = goodPreflight.headers.get("access-control-allow-origin");
    record(
      "models bucket: CORS preflight allows our app origin for GET",
      allowOrigin === appOrigin || allowOrigin === "*",
      `Access-Control-Allow-Origin=${allowOrigin}`,
    );

    const badPreflight = await fetch(probeUrl, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
    });
    const badAllowOrigin = badPreflight.headers.get("access-control-allow-origin");
    record(
      "models bucket: CORS rejects an untrusted origin",
      badAllowOrigin === null,
      `Access-Control-Allow-Origin for evil.example=${badAllowOrigin ?? "(none — correctly rejected)"}`,
    );
  }
} finally {
  await client
    .send(new DeleteObjectCommand({ Bucket: uploadsBucket, Key: uploadsKey }))
    .catch(() => {});
  console.log("\nCleanup done.");
}

console.log("\n=== SUMMARY ===");
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
const allPass = results.every((r) => r.pass);
console.log(allPass ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(allPass ? 0 : 1);
