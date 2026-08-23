import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, getUploadsBucket } from "@/lib/r2";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, isAllowedImageType } from "@/lib/uploads";

const PRESIGN_EXPIRY_SECONDS = 5 * 60;

/**
 * Issues a presigned PUT URL for a source photo. The browser uploads
 * directly to R2 with it — no image bytes ever pass through this route.
 *
 * CLAUDE.md rule 30: proxy.ts already redirects logged-out browsers away
 * from /dashboard, but that's a UX convenience, not a boundary — this route
 * independently verifies the caller below regardless of what proxy did.
 */
export async function POST(request: Request) {
  // CLAUDE.md rule 31: getUser() round-trips to the Auth server and
  // confirms the token is still valid; getSession() would trust a cookie
  // that could be stale or forged.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contentType, contentLength } = (body ?? {}) as {
    contentType?: unknown;
    contentLength?: unknown;
  };

  if (typeof contentType !== "string" || !isAllowedImageType(contentType)) {
    return NextResponse.json(
      {
        error: `Unsupported contentType. Allowed: ${Object.keys(ALLOWED_IMAGE_TYPES).join(", ")}`,
      },
      { status: 400 },
    );
  }

  if (
    typeof contentLength !== "number" ||
    !Number.isInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_UPLOAD_BYTES
  ) {
    return NextResponse.json(
      { error: `contentLength must be a positive integer up to ${MAX_UPLOAD_BYTES} bytes` },
      { status: 400 },
    );
  }

  // Key is ALWAYS derived server-side from the authenticated user's id and
  // a fresh UUID — never accepted from the client. A client-supplied key
  // (or one derived from a client-supplied filename) would let a caller
  // write into another user's uploads/ prefix.
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  const key = `uploads/${user.id}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: getUploadsBucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return NextResponse.json({
    uploadUrl,
    key,
    contentType,
    expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000).toISOString(),
  });
}
