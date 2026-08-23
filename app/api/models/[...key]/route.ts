import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getModelsBucket } from "@/lib/r2";

/**
 * Dev/staging-only stand-in for the real CDN (see lib/models.ts). Streams an
 * object straight from the `models` bucket so Phase 4 is testable before
 * NEXT_PUBLIC_MODELS_CDN_URL points at a real cdn.<domain> — this route is
 * simply never hit once that env var is set, no code here needs to change.
 *
 * Not a presigned redirect (rule 6's expiry concern is specifically about
 * links a user shares outside our app — QR codes, AR launch links; this
 * route itself never expires, it fetches fresh from R2 on every request) and
 * not r2.dev (rule 4) — just this server, which already holds R2
 * credentials, forwarding bytes it already has a legitimate reason to read.
 *
 * `models` is a public bucket by design (rule 6 — unguessable UUID keys, no
 * auth gate), so this route doesn't check the caller's session either. That
 * design protects confidentiality (finding someone else's model by guessing)
 * but not cost: an unauthenticated, unrated route that hits R2 on every
 * request is a real volumetric cost target regardless of key guessability —
 * two things below narrow that without adding real infrastructure:
 *
 * 1. KEY_RE rejects an obviously-malformed path before ever touching R2 —
 *    cheap, and every real key this route will ever legitimately see matches
 *    it exactly (constructed once, in app/api/webhooks/tripo/route.ts, as
 *    `models/${model.id}.${stage}`).
 * 2. `s-maxage` on the Cache-Control response, which the pass-through of
 *    R2's own stored header (rule 3 — public, max-age=31536000, immutable)
 *    did NOT have. Vercel's CDN only caches a function's response when the
 *    header includes s-maxage specifically — plain max-age is a browser-only
 *    directive there — so without this, every fetch of every model, not just
 *    abuse traffic, was a fresh function invocation + R2 read, forever. Model
 *    files are genuinely immutable once written (a given id.stage key is
 *    written exactly once), so this is a correct cache, not just a fast one.
 */
const KEY_RE = /^models\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(glb|usdz|webp)$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  if (!KEY_RE.test(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let object;
  try {
    object = await getR2Client().send(new GetObjectCommand({ Bucket: getModelsBucket(), Key: key }));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!object.Body) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await object.Body.transformToByteArray();
  const cacheControl = object.CacheControl ? `${object.CacheControl}, s-maxage=31536000` : "no-store";

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": object.ContentType || "application/octet-stream",
      "Cache-Control": cacheControl,
    },
  });
}
