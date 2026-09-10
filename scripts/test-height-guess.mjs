// Throwaway diagnostic — checks what lib/gemini.ts's guessModelHeightCm
// currently predicts for a given model's source photo, run a few times to
// see the spread (temperature: 0.4 means it isn't deterministic).
//
//   node --conditions=react-server --env-file=.env.local scripts/test-height-guess.mjs <sourceImageKey> [times]
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { guessModelHeightCm } from "../lib/gemini.ts";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

const [, , sourceImageKey, timesArg] = process.argv;
if (!sourceImageKey) {
  console.error("Usage: node --conditions=react-server --env-file=.env.local scripts/test-height-guess.mjs <sourceImageKey> [times]");
  process.exit(1);
}
const times = Number(timesArg) || 3;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  },
});
const uploadsBucket = requiredEnv("R2_UPLOADS_BUCKET");

const object = await r2.send(new GetObjectCommand({ Bucket: uploadsBucket, Key: sourceImageKey }));
const bytes = Buffer.from(await object.Body.transformToByteArray());
const mimeType = object.ContentType || "image/jpeg";

console.log(`Testing height guess for ${sourceImageKey} (${bytes.length} bytes, ${mimeType}), ${times} run(s):`);
for (let i = 0; i < times; i++) {
  try {
    const heightCm = await guessModelHeightCm(bytes, mimeType);
    console.log(`  run ${i + 1}: ${heightCm} cm`);
  } catch (err) {
    console.log(`  run ${i + 1}: FAILED —`, err instanceof Error ? err.message : err);
  }
}
