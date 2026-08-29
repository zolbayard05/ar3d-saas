import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, getUploadsBucket } from "@/lib/r2";

/**
 * Read proxy for the private `uploads` bucket — needed for the home feed's
 * card thumbnails (design/01-home-feed.png shows the source photo; there
 * was previously no read path for this bucket at all, only the presigned
 * PUT in app/api/upload-url).
 *
 * Unlike app/api/models/[...key]/route.ts (rule 6 — models bucket is public
 * by design, unguessable UUID keys, no auth gate needed), `uploads` holds
 * private user photos and must check ownership per rule 30: every route
 * independently verifies the caller, never trusting that proxy.ts or the
 * key's own shape already did. Keys are always `uploads/{userId}/{uuid}.ext`
 * (enforced server-side at upload time, never client-supplied — see
 * app/api/upload-url), so checking the prefix against the authenticated
 * caller's own id is sufficient to confirm ownership.
 *
 * Second, narrower allowance added for the public showcase feed (migration
 * 0013): a showcase model's card is rendered for every visitor, signed in
 * or not, so its source photo can't stay owner-only or every showcase
 * thumbnail 401s for everyone but the admin — confirmed live before this
 * was added, not assumed. Scoped tight: the request-scoped client (never
 * admin/service-role — no reason to reach past what the caller's own RLS
 * grants already permit) must find a `status = 'ready', is_showcase = true`
 * row whose OWN source_image_key is an EXACT match for the requested key.
 * Since is_showcase has no client write path at all (that migration's own
 * comment), this only ever opens the specific ~10 photos an admin actually
 * curated — never a guessable path to anyone else's private upload.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  const isOwnKey = !!user && key.startsWith(`uploads/${user.id}/`);
  if (!isOwnKey) {
    const { data: showcaseModel } = await supabase
      .from("models")
      .select("id")
      .eq("source_image_key", key)
      .eq("status", "ready")
      .eq("is_showcase", true)
      .limit(1)
      .maybeSingle();

    if (!showcaseModel) {
      // Reads identically to "doesn't exist" for a non-owner/non-showcase
      // key, same rationale as the models detail page's ownership check —
      // don't leak whether the key belongs to someone else.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  let object;
  try {
    object = await getR2Client().send(new GetObjectCommand({ Bucket: getUploadsBucket(), Key: key }));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!object.Body) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Streamed (2026-08-29), not buffered — `transformToByteArray()`
  // previously read the WHOLE object into memory before this function sent
  // a single byte back, adding full-object latency (and, on a busy feed
  // fetching a few dozen thumbnails at once, real memory pressure) to
  // every one of this route's calls. object.Body is a Node Readable in
  // this route's (default Node.js) runtime — Readable.toWeb() hands it
  // straight to NextResponse, which starts forwarding bytes to the client
  // as R2 delivers them instead of waiting for the full download first.
  const stream = Readable.toWeb(object.Body as Readable) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": object.ContentType || "application/octet-stream",
      ...(object.ContentLength != null
        ? { "Content-Length": String(object.ContentLength) }
        : {}),
      // `private` — never cache-shared the way models/ is (rule 3 is about
      // the public models bucket; this is the opposite) — but NOT no-store:
      // every request here was a fresh getUser() + DB check + R2 read with
      // zero caching at all, on the hot path of both feeds' every card
      // thumbnail. `private` scopes the cache to the requester's own
      // browser only (no shared/CDN layer involved, so this doesn't weaken
      // the ownership check above — that still runs on every miss), and
      // the object itself is immutable once uploaded (a given
      // source_image_key's bytes never change), so a long max-age is
      // correct, not just fast — same reasoning as rule 3's own
      // immutable models cache, adapted to a private (not shared) scope.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
