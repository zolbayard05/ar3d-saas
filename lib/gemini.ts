import "server-only";

// gemini-2.5-flash-lite (the model originally picked from pricing research)
// returns HTTP 404 "no longer available to new users" as of 2026-08-24 even
// though it's still listed by the API's own ListModels — confirmed against
// that live list (models.list with this project's real key) that
// gemini-3.5-flash-lite both exists and is callable; it's Google's own
// 404-message-suggested replacement. Standard-tier pricing confirmed
// directly from ai.google.dev/gemini-api/docs/pricing: $0.30/1M input,
// $2.50/1M output. Measured on a real call against a real source photo:
// 1,101 prompt tokens (1,080 image + 21 text), 5 output tokens — about
// $0.00033/call for that original title-only prompt. The prompt now also
// asks for a heightCm guess (see METADATA_PROMPT) in the same call rather
// than a second one — a few dozen more output tokens for the JSON
// structure, still negligible next to a Tripo generation. Fires once per
// completed model, same cadence as Tripo generations, which are already
// the tighter cost bottleneck.
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// One call does both jobs (title + size guess) instead of two — same photo,
// same round trip, no second paid request. Title asks explicitly for the
// term a native speaker would actually reach for, not a word-for-word
// translation (a literal rendering of an English catalog title reads
// stilted/foreign in Mongolian). heightCm is the other half of rule 22:
// Tripo's mesh has no real-world scale at all, so a generic, unconditional
// "make your best guess from typical proportions for this kind of object"
// prompt is the entire signal — it's deliberately not shown the source
// photo's own pixel dimensions or any reference object, because there
// isn't one to show; this is a starting point for the scale slider
// (rule 22), not a measurement, and is treated as such by every caller.
const METADATA_PROMPT =
  "This photo shows a physical object that was turned into a 3D AR model for a " +
  "Mongolian marketplace app. Reply with ONLY a single JSON object, no other text, " +
  "with exactly two fields:\n" +
  '"title": a short, natural Mongolian product title (2-5 words, no punctuation, ' +
  "no quotes) — the term a native Mongolian speaker would actually use for this " +
  "product category, not a literal word-for-word translation of an English name.\n" +
  '"heightCm": your best-guess estimate of this specific object\'s real-world height ' +
  "in centimeters, as a plain number, reasoned from its visible proportions and " +
  "typical sizes for objects of its kind.\n" +
  'Example: {"title": "Модон Хоолны Сандал", "heightCm": 90}';

const MAX_TITLE_LENGTH = 60;
const GEMINI_TIMEOUT_MS = 15_000;
// Loose sanity bounds on the height guess, not a real measurement range —
// wide enough to span a coffee mug to a wardrobe, tight enough to reject an
// obviously hallucinated value (e.g. a stray "0" or "9000") before it ever
// reaches the scale math below.
const MIN_PLAUSIBLE_HEIGHT_CM = 1;
const MAX_PLAUSIBLE_HEIGHT_CM = 400;

export interface ModelMetadata {
  title: string;
  /** null if Gemini's guess was missing/unusable — callers must leave scale at its default in that case, not fabricate one. */
  heightCm: number | null;
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

function sanitizeTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.]+$/, "")
    .slice(0, MAX_TITLE_LENGTH);
}

function sanitizeHeightCm(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < MIN_PLAUSIBLE_HEIGHT_CM || n > MAX_PLAUSIBLE_HEIGHT_CM) return null;
  return n;
}

/**
 * Best-effort — every caller must catch and continue without metadata on
 * failure (rule 24's "never fail a paid generation over a cosmetic step"
 * applies equally here: naming/sizing are decorative refinements on top of
 * an already-successful generation, not load-bearing).
 */
export async function generateModelMetadata(imageBytes: Buffer, mimeType: string): Promise<ModelMetadata> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${GEMINI_API_URL}?key=${getApiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: METADATA_PROMPT }, { inlineData: { mimeType, data: imageBytes.toString("base64") } }],
          },
        ],
        generationConfig: { maxOutputTokens: 60, temperature: 0.4, responseMimeType: "application/json" },
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

  const parsed = JSON.parse(rawText) as { title?: unknown; heightCm?: unknown };

  const title = sanitizeTitle(typeof parsed.title === "string" ? parsed.title : "");
  if (!title) throw new Error("Gemini returned an empty/unusable title");

  return { title, heightCm: sanitizeHeightCm(parsed.heightCm) };
}
