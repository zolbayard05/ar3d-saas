import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.example`);
  return value;
}

/**
 * R2 is S3-compatible; region 'auto' lets Cloudflare route to the bucket's
 * actual location without us tracking it. Credentials come from an R2 API
 * token (dashboard > R2 > Manage API Tokens), never the Cloudflare account-
 * wide API key. `import "server-only"` makes an accidental import from a
 * Client Component a build error, not a runtime credential leak — same
 * pattern as lib/supabase/admin.ts.
 *
 * Lazily constructed (not built at module load): Next collects route config
 * for every route at build time by evaluating the module, including on
 * machines/CI runs that don't have R2 credentials yet — a top-level throw
 * here would fail `next build` project-wide, not just this route. Env vars
 * are only required once a request actually reaches a route that calls
 * these.
 */
let cachedClient: S3Client | undefined;

export function getR2Client(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return cachedClient;
}

export function getUploadsBucket(): string {
  return requiredEnv("R2_UPLOADS_BUCKET");
}

export function getModelsBucket(): string {
  return requiredEnv("R2_MODELS_BUCKET");
}

/**
 * CLAUDE.md rule 2 — R2 defaults new objects to application/octet-stream,
 * and iOS Quick Look fails SILENTLY (no error, nothing happens) when a
 * .usdz is served with the wrong Content-Type. Every write to the models
 * bucket (Phase 3's generation pipeline) must set one of these explicitly —
 * never rely on the SDK or a browser to infer it.
 */
export const MODEL_CONTENT_TYPES = {
  glb: "model/gltf-binary",
  usdz: "model/vnd.usdz+zip",
} as const;

// CLAUDE.md rule 3 — applies to every object written to the models bucket.
export const MODEL_CACHE_CONTROL = "public, max-age=31536000, immutable";
