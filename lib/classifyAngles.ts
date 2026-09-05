import "server-only";
import { getGeminiApiKey } from "@/lib/gemini";

/**
 * AI-driven replacement for CaptureChoice.tsx's old ARRAY-POSITION angle
 * assignment (2026-09-04, replaced same day — see that file's own git
 * history). The array-position version assigned lib/tripo.ts's multiview
 * [front,left,back,right] slots purely by upload order: whichever photo
 * got added 2nd became "left," no matter what angle it actually showed.
 * Confirmed as a real, live bug two separate ways: a close-up detail crop
 * submitted as a 4th orbital angle produced a warped/duplicated mesh, and
 * a front+back-only product (2 photos, in that order) would submit "back"
 * as "left" — no way to target a specific slot or leave an earlier one
 * empty in an append-only array.
 *
 * This replaces manual/positional slot assignment with a single Gemini
 * vision call that looks at ALL submitted photos together (not one at a
 * time — front/left/back/right is inherently a RELATIVE judgment: knowing
 * "photo 3 shows the opposite side from photo 1" requires seeing both) and
 * decides which one, if any, best represents each of the 4 canonical
 * angles — explicitly excluding close-ups/detail crops/duplicates rather
 * than force-fitting them into a slot. A user can now hand over however
 * many photos they actually have (2 for a product with only front+back
 * shots, 7 from an extension's gallery scan, ...) and this picks the best
 * subset instead of requiring the user to identify/order angles themselves
 * — the same "no reliable way to know real camera angle" problem the
 * extension's own auto-scan already can't solve any other way, since
 * background.js's gallery scan has literally no signal beyond "found near
 * the clicked image."
 */

export type AngleSlot = "front" | "left" | "back" | "right";
const ANGLE_SLOTS: AngleSlot[] = ["front", "left", "back", "right"];

// gemini-3.5-flash — deliberately NOT the -lite variant lib/gemini.ts's
// single-image height-guess call uses. This task is qualitatively harder:
// judging "which of these N photos shows the opposite side from THAT
// other one" is a relative, cross-image reasoning task, not a one-shot
// visual estimate, and non-lite's extra capability showed up directly in
// testing — verified live against a real adversarial photo set (a
// production model's actual 4 source images, including the exact
// close-up-crop-in-an-angle-slot defect this function exists to prevent)
// with the order deliberately shuffled: correctly picked front/back
// regardless of upload position, correctly identified the side-view photo
// as a real angle, and correctly excluded the close-up crop from every
// slot rather than force-fitting it. Cost difference vs. -lite is a
// rounding error next to a single Tripo generation either way (rule 12 —
// tens of credits), so reliability wins here without a real tradeoff.
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Higher than the single-image height-guess call's 15s (lib/gemini.ts) —
// this sends up to MAX_CLASSIFY_IMAGES images in one request, meaningfully
// more input tokens/decode time.
const GEMINI_TIMEOUT_MS = 25_000;

// Upper bound on how many photos this will ever send to Gemini in one
// call — matches extension/background.js's own MAX_CANDIDATES (its
// gallery scan already caps candidates at 8; there's no reason this
// accepts more than what that scan could ever hand it). Not the same
// number as Tripo's own 4-slot limit (lib/tripo.ts's multiview_to_model)
// — the whole point of this function is picking the best 4 (or fewer) out
// of a potentially larger candidate pool, not requiring the caller to
// have already narrowed it down.
export const MAX_CLASSIFY_IMAGES = 8;

export interface ClassifyImageInput {
  /** Opaque caller-supplied identifier for this image (an R2 key, an
   * array index as a string, ...) — round-tripped back in the result,
   * never interpreted here. */
  id: string;
  bytes: Buffer;
  mimeType: string;
}

export type ClassifyAnglesResult = Record<AngleSlot, string | null>;

function buildPrompt(count: number): string {
  return (
    `These are ${count} numbered photos (Photo 1 through Photo ${count}, in the order given below) that may or may not all be ` +
    "the SAME physical product — the set can include duplicates, close-up/detail crops (e.g. a logo or texture), or unrelated shots. " +
    "For each of these 4 canonical angles — FRONT, BACK, LEFT side, RIGHT side — identify which single photo number, if any, " +
    "clearly shows the WHOLE product from roughly that angle. A photo only qualifies for a slot if the entire product is " +
    "visible in it (not a zoomed-in crop of one detail/logo/part) and it is actually the same product as the others. " +
    "If no photo clearly shows a given angle, or you are not confident, use null for that slot rather than guessing. " +
    "Never assign the same photo number to more than one slot. " +
    "Reply with ONLY a single JSON object, no other text, in exactly this shape: " +
    '{"front": <number|null>, "left": <number|null>, "back": <number|null>, "right": <number|null>}'
  );
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/**
 * Best-effort — throws on hard failure (network/API error, unparseable
 * response); callers must catch and fall back (e.g. treat the first image
 * as "front," send nothing else) rather than blocking generation over
 * this refinement step, same rule lib/gemini.ts's own height guess
 * already follows.
 *
 * One retry on any failure (network, non-OK, unparseable/truncated
 * response) before giving up to the caller's fallback — cheap insurance
 * against a transient blip costing the user their multi-angle result.
 */
export async function classifyAngles(images: ClassifyImageInput[]): Promise<ClassifyAnglesResult> {
  if (images.length === 0) throw new Error("classifyAngles: no images given");
  if (images.length > MAX_CLASSIFY_IMAGES) {
    throw new Error(`classifyAngles: ${images.length} images given, max is ${MAX_CLASSIFY_IMAGES}`);
  }

  try {
    return await classifyAnglesOnce(images);
  } catch {
    return await classifyAnglesOnce(images);
  }
}

async function classifyAnglesOnce(images: ClassifyImageInput[]): Promise<ClassifyAnglesResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  const parts: GeminiPart[] = [{ text: buildPrompt(images.length) }];
  images.forEach((img, i) => {
    parts.push({ text: `Photo ${i + 1}:` });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.bytes.toString("base64") } });
  });

  let res: Response;
  try {
    res = await fetch(`${GEMINI_API_URL}?key=${getGeminiApiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts }],
        // maxOutputTokens must cover gemini-3.5-flash's own internal
        // "thinking" tokens, not just the final JSON — confirmed live: at
        // 100 (this call's first attempt), every response hit
        // finishReason "MAX_TOKENS" with the entire budget consumed by
        // thoughtsTokenCount before a single output token was written,
        // leaving no text to parse at all. 2048 leaves extra headroom
        // above the 1024 that was enough on a 4-image test set, in case a
        // harder (e.g. 8-image) request thinks longer.
        generationConfig: { maxOutputTokens: 2048, temperature: 0.1, responseMimeType: "application/json" },
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Gemini API error: HTTP ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini response had no text");

  const parsed = JSON.parse(rawText) as Partial<Record<AngleSlot, number | null>>;

  // Defensive against a malformed/adversarial-looking response (repeated
  // index across slots, out-of-range index) — silently drops the second
  // (and any later) conflicting assignment rather than trusting Gemini's
  // own "never reuse an index" instruction unconditionally, and an
  // out-of-range index is just treated as "no photo for this slot."
  const usedIndices = new Set<number>();
  const result: ClassifyAnglesResult = { front: null, left: null, back: null, right: null };
  for (const slot of ANGLE_SLOTS) {
    const idx = parsed[slot];
    if (typeof idx === "number" && Number.isInteger(idx) && idx >= 1 && idx <= images.length && !usedIndices.has(idx)) {
      result[slot] = images[idx - 1].id;
      usedIndices.add(idx);
    }
  }
  return result;
}
