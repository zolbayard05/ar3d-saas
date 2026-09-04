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
 *    it (constructed in app/api/webhooks/tripo/route.ts as
 *    `models/${model.id}.${stage}` for the original glb/usdz/webp, OR — for
 *    a GLB that's had scale baked into its geometry, sizeModel()'s automatic
 *    guess or app/api/models/rescale/route.ts's user-driven update — as
 *    `models/${model.id}.${8-hex}.glb`, a fresh key per bake so the
 *    immutable Cache-Control below never serves a stale scale. Regressed
 *    once, silently: KEY_RE originally only matched the no-suffix form,
 *    so every scale-baked GLB 404'd here (USDZ, never re-baked, kept
 *    working — that's what made it look GLB-specific) since production
 *    has no NEXT_PUBLIC_MODELS_CDN_URL yet and so serves every model
 *    through this exact route. Caught 2026-09-02 via a real report that
 *    the AR viewer wasn't loading models at all.
 * 2. `s-maxage` on the Cache-Control response, which the pass-through of
 *    R2's own stored header (rule 3 — public, max-age=31536000, immutable)
 *    did NOT have. Vercel's CDN only caches a function's response when the
 *    header includes s-maxage specifically — plain max-age is a browser-only
 *    directive there — so without this, every fetch of every model, not just
 *    abuse traffic, was a fresh function invocation + R2 read, forever. Model
 *    files are genuinely immutable once written (a given key is written
 *    exactly once, ever — the versioned-suffix scheme above is what keeps
 *    that true even across a rescale), so this is a correct cache, not just
 *    a fast one.
 */
const KEY_RE = /^models\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[0-9a-f]{8})?\.(glb|usdz|webp)$/i;

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
      // The web app never needed this (browser-navigated same-origin
      // requests aren't CORS-gated at all) — added for the Chrome
      // extension's popup (a genuinely different chrome-extension:// origin)
      // to render an interactive <model-viewer> preview of the just-
      // generated model. Same threat model as rule 6/5's public models
      // bucket already accepts: unguessable UUID keys, no auth, no
      // credentials on this response — wildcard costs nothing beyond what
      // guessing the key already would.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
