import "server-only";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getUploadsBucket } from "@/lib/r2";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, isAllowedImageType } from "@/lib/uploads";

const PRESIGN_EXPIRY_SECONDS = 5 * 60;

export interface PresignUploadInput {
  contentType: unknown;
  contentLength: unknown;
}

export type PresignUploadResult =
  | { ok: true; uploadUrl: string; key: string; contentType: string; expiresAt: string }
  | { ok: false; status: number; error: string };

/**
 * Shared by app/api/upload-url/route.ts (cookie-authed) and
 * app/api/extension/upload-url/route.ts (token-authed) — everything after
 * "who is this user" is identical between the two callers, so it lives here
 * once rather than being copied. Callers must resolve and verify `userId`
 * themselves first (rule 30 — each route independently authenticates its
 * own caller before ever reaching this function).
 */
export async function presignUpload(userId: string, input: PresignUploadInput): Promise<PresignUploadResult> {
  const { contentType, contentLength } = input;

  if (typeof contentType !== "string" || !isAllowedImageType(contentType)) {
    return {
      ok: false,
      status: 400,
      error: `Дэмжигдэхгүй contentType. Зөвшөөрөгдсөн: ${Object.keys(ALLOWED_IMAGE_TYPES).join(", ")}`,
    };
  }

  if (
    typeof contentLength !== "number" ||
    !Number.isInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_UPLOAD_BYTES
  ) {
    return {
      ok: false,
      status: 400,
      error: `contentLength нь ${MAX_UPLOAD_BYTES} байтаас хэтрэхгүй эерэг бүхэл тоо байх ёстой`,
    };
  }

  // Key is ALWAYS derived server-side from the authenticated user's id and
  // a fresh UUID — never accepted from the client. A client-supplied key
  // (or one derived from a client-supplied filename) would let a caller
  // write into another user's uploads/ prefix.
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  const key = `uploads/${userId}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: getUploadsBucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return {
    ok: true,
    uploadUrl,
    key,
    contentType,
    expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000).toISOString(),
  };
}
