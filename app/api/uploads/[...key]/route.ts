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
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  if (!key.startsWith(`uploads/${user.id}/`)) {
    // Reads identically to "doesn't exist" for a non-owner, same rationale
    // as the models detail page's ownership check — don't leak whether the
    // key belongs to someone else.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const bytes = await object.Body.transformToByteArray();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": object.ContentType || "application/octet-stream",
      // Private and user-specific — never cache-shared the way models/ is
      // (rule 3 is about the public models bucket; this is the opposite).
      "Cache-Control": "private, no-store",
    },
  });
}
