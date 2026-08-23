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
 * auth gate), so this route doesn't check the caller's session either.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await params;
  const key = keyParts.join("/");

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

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": object.ContentType || "application/octet-stream",
      "Cache-Control": object.CacheControl || "no-store",
    },
  });
}
