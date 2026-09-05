import "server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getUploadsBucket } from "@/lib/r2";
import { classifyAngles, MAX_CLASSIFY_IMAGES, type ClassifyAnglesResult } from "@/lib/classifyAngles";

export type ClassifyUploadedAnglesResult =
  | { ok: true; slots: ClassifyAnglesResult }
  | { ok: false; status: number; error: string };

/**
 * Shared by app/api/classify-angles/route.ts (cookie-authed) and
 * app/api/extension/classify-angles/route.ts (token-authed) — same
 * resolved-userId pattern as lib/generateModel.ts's submitGeneration.
 * Callers must resolve and independently verify `userId` themselves first
 * (rule 30); this function trusts it.
 *
 * `keys` are R2 keys already sitting in the private `uploads` bucket (the
 * caller uploaded them via presignUpload first, same as the required front
 * photo always has been) — ownership is re-checked here the same way
 * lib/generateModel.ts's submitGeneration checks sourceImageKey: a key
 * must start with `uploads/{userId}/`, which presignUpload always derives
 * server-side and a client can never forge into pointing at someone else's
 * photo.
 */
export async function classifyUploadedAngles(userId: string, keys: unknown): Promise<ClassifyUploadedAnglesResult> {
  if (!Array.isArray(keys) || keys.length === 0) {
    return { ok: false, status: 400, error: "keys хоосон эсвэл буруу байна" };
  }
  if (keys.length > MAX_CLASSIFY_IMAGES) {
    return { ok: false, status: 400, error: `Хамгийн ихдээ ${MAX_CLASSIFY_IMAGES} зураг шинжилж болно` };
  }
  const validatedKeys: string[] = [];
  for (const key of keys) {
    if (typeof key !== "string" || !key.startsWith(`uploads/${userId}/`)) {
      return { ok: false, status: 400, error: "Зургийн key буруу байна" };
    }
    validatedKeys.push(key);
  }

  const r2 = getR2Client();
  const bucket = getUploadsBucket();

  let images;
  try {
    images = await Promise.all(
      validatedKeys.map(async (key) => {
        const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!obj.Body) throw new Error(`empty body for ${key}`);
        const bytes = Buffer.from(await obj.Body.transformToByteArray());
        return { id: key, bytes, mimeType: obj.ContentType || "image/jpeg" };
      }),
    );
  } catch (err) {
    return { ok: false, status: 400, error: `Зургуудыг уншихад алдаа гарлаа: ${err instanceof Error ? err.message : "тодорхойгүй алдаа"}` };
  }

  try {
    const slots = await classifyAngles(images);
    return { ok: true, slots };
  } catch (err) {
    // Classification is a refinement, not load-bearing (rule 24's own
    // "never fail a paid step over a cosmetic one" spirit) — but THIS
    // route's whole job is classification, so unlike submitGeneration
    // (which just proceeds without a scale guess on Gemini failure), a
    // failure here has to be surfaced as an error response for the
    // caller to fall back on (e.g. "use the first photo as front, send
    // nothing else") rather than silently returning an empty result that
    // looks identical to "no angles found."
    //
    // Also logged server-side (unlike the caller's own client-side
    // console.warn) — without this, a real outage (Gemini quota
    // exhausted, key revoked) is invisible: every multi-photo user
    // silently degrades to single-angle and nothing ever surfaces it.
    // classifyAngles's own error message embeds Gemini's HTTP status
    // (429 = rate/quota limit, 403 = invalid/revoked key) — check Vercel
    // function logs for this line to tell a real outage from one-off
    // network noise.
    console.warn("classifyUploadedAngles: classifyAngles failed after retry, caller falls back to single-angle", err);
    return { ok: false, status: 502, error: `Зургийг ангилахад алдаа гарлаа: ${err instanceof Error ? err.message : "тодорхойгүй алдаа"}` };
  }
}
