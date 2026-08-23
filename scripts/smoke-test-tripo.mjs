// One-off live check against the real Tripo API: submits a single
// image-to-model task and prints the raw response. Doesn't touch R2 or
// Supabase — this only answers "does this account/key have usable credit on
// the API side right now", independent of what Studio's balance shows (that
// distinction mattered: a 2010 "not enough credit" error persisted here
// after Studio already showed a positive balance).
//
// Usage:
//   node --env-file=.env.local scripts/smoke-test-tripo.mjs [image-url]
//
// image-url defaults to a public placeholder (flat-color square) — good
// enough to exercise auth/credit/queueing, useless for judging mesh
// quality. Pass a real photo URL to check output quality instead.
const apiKey = process.env.TRIPO_API_KEY;
if (!apiKey) {
  console.error("TRIPO_API_KEY is not set — see .env.example");
  process.exit(1);
}

const model = process.env.TRIPO_MODEL_VERSION || "v2.5-20250123";
const sourceImageUrl = process.argv[2] || "https://placehold.co/512x512.jpg";

console.log(`POST /generation/image-to-model  model=${model}  input=${sourceImageUrl}`);

const res = await fetch("https://openapi.tripo3d.ai/v3/generation/image-to-model", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ model, input: sourceImageUrl }),
});

const json = await res.json().catch(() => null);
console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(json, null, 2));

if (json?.code === 2010) {
  console.error("\ncode 2010: not enough credit on the API side (Studio balance can lag/differ).");
  process.exit(1);
}
if (!res.ok || !json || json.code !== 0) {
  console.error("\nRequest failed — see response above.");
  process.exit(1);
}

console.log(`\nqueued OK — task_id: ${json.data?.task_id}`);
