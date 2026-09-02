import "server-only";

// gemini-2.5-flash-lite (the model originally picked from pricing research)
// returns HTTP 404 "no longer available to new users" as of 2026-08-24 even
// though it's still listed by the API's own ListModels — confirmed against
// that live list (models.list with this project's real key) that
// gemini-3.5-flash-lite both exists and is callable; it's Google's own
// 404-message-suggested replacement. Standard-tier pricing confirmed
// directly from ai.google.dev/gemini-api/docs/pricing: $0.30/1M input,
// $2.50/1M output — a single-number JSON reply is a handful of output
// tokens, negligible next to a Tripo generation. Fires once per completed
// model, same cadence as Tripo generations, which are already the tighter
// cost bottleneck.
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// This used to also auto-generate a title in the same call — removed
// 2026-09-02 (product decision: an AI-guessed name read as odd/off often
// enough that no name at all was preferred; titles were dropped entirely
// shortly after, including manual renaming — models simply have none). The
// height guess stays: it's the other half of
// rule 22 ("AI meshes have no real-world scale, provide a scale control")
// — Tripo's mesh has no real-world scale at all, so a generic,
// unconditional "make your best guess from typical proportions for this
// kind of object" prompt is the entire signal. Deliberately not shown the
// source photo's own pixel dimensions or any reference object, because
// there isn't one to show; this is a starting point for the scale slider,
// not a measurement, and is treated as such by every caller.
const HEIGHT_PROMPT =
  "This photo shows a physical object that was turned into a 3D AR model. " +
  "Reply with ONLY a single JSON object, no other text, with exactly one field: " +
  '"heightCm": your best-guess estimate of this specific object\'s real-world height ' +
  "in centimeters, as a plain number, reasoned from its visible proportions and " +
  'typical sizes for objects of its kind. Example: {"heightCm": 90}';

const GEMINI_TIMEOUT_MS = 15_000;
// Loose sanity bounds on the height guess, not a real measurement range —
// wide enough to span a coffee mug to a wardrobe, tight enough to reject an
// obviously hallucinated value (e.g. a stray "0" or "9000") before it ever
// reaches the scale math below.
const MIN_PLAUSIBLE_HEIGHT_CM = 1;
const MAX_PLAUSIBLE_HEIGHT_CM = 400;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

function sanitizeHeightCm(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < MIN_PLAUSIBLE_HEIGHT_CM || n > MAX_PLAUSIBLE_HEIGHT_CM) return null;
  return n;
}

/**
 * Best-effort — every caller must catch and continue without a guess on
 * failure (rule 24's "never fail a paid generation over a cosmetic step"
 * applies equally here: this is a refinement on top of an already-
 * successful generation, not load-bearing). Returns null rather than
 * throwing for an unusable/out-of-range guess, same as a network/API
 * failure — callers can't tell the difference and don't need to.
 */
export async function guessModelHeightCm(imageBytes: Buffer, mimeType: string): Promise<number | null> {
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
            parts: [{ text: HEIGHT_PROMPT }, { inlineData: { mimeType, data: imageBytes.toString("base64") } }],
          },
        ],
        generationConfig: { maxOutputTokens: 30, temperature: 0.4, responseMimeType: "application/json" },
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

  const parsed = JSON.parse(rawText) as { heightCm?: unknown };
  return sanitizeHeightCm(parsed.heightCm);
}
