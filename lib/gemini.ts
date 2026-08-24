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
// $0.00033/call, and the model also has a genuine free tier. Naming fires
// once per completed model, same cadence as Tripo generations, which are
// already the tighter cost bottleneck.
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const NAMING_PROMPT =
  "This photo shows a physical object that was turned into a 3D AR model. " +
  "Reply with ONLY a short, specific product-style title for the object " +
  '(2-5 words, title case, no punctuation, no quotes, no explanation) — ' +
  'for example "Wooden Dining Chair" or "Ceramic Coffee Mug".';

const MAX_TITLE_LENGTH = 60;
const GEMINI_TIMEOUT_MS = 15_000;

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

/**
 * Best-effort — every caller must catch and continue without a title on
 * failure (rule 24's "never fail a paid generation over a cosmetic step"
 * applies equally here: naming is decorative, not load-bearing).
 */
export async function generateModelTitle(imageBytes: Buffer, mimeType: string): Promise<string> {
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
            parts: [{ text: NAMING_PROMPT }, { inlineData: { mimeType, data: imageBytes.toString("base64") } }],
          },
        ],
        generationConfig: { maxOutputTokens: 20, temperature: 0.4 },
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

  const title = sanitizeTitle(rawText);
  if (!title) throw new Error("Gemini returned an empty/unusable title");
  return title;
}
