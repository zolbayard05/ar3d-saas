import "server-only";
import sharp from "sharp";

// How strongly the low-frequency (baked-lighting) layer is pulled toward its
// own global mean before recombining with the high-frequency (weave/grain)
// layer. 1.0 = fully flat (loses all large-scale form shading, e.g. a
// cushion's natural curvature falloff — a "sticker" look). 0.0 = no change.
//
// REVISED 2026-09-01 (0.9 -> 0.6): 0.9 was tuned against one real generation
// (chair, fabric + wood, light/mid-tone material) — verified visually and
// numerically there (a sampled UV-seam luminance gap of 23.5 dropped to 2.5,
// a ~90% reduction). Not tested across material *darkness* at the time —
// this is the same class of bug as BLUR_SIGMA_RATIO below (a constant
// validated on one sample silently misbehaving on a different one), just
// triggered by color instead of resolution. Found live on a black gaming
// chair: pulling 90% of the way toward the image's global mean is
// devastating specifically when that mean is already near-black (little
// headroom before hitting 0) — measured directly on the shipped GLB texture,
// mean luminance 42/255, stdev crashed to 8.3/255 (a visibly flat, "sticker"
// result — see the incident's before/after screenshots). A light material's
// mean sits much further from black, so the same 90% pull has real headroom
// left over and reads as "cleaned up," not "erased."
//
// 0.6 is a corrective adjustment, not a newly-measured optimum — still only
// validated against this one dark-object incident (the same "one sample"
// caveat 0.9 had). The per-model seam-gap log this function's caller already
// emits (app/api/webhooks/tripo/route.ts) is what should turn this into a
// measured value across enough real objects, the same mechanism rule 21's
// DEFAULT_FACE_LIMIT and glbCompress.ts's MAX_ASPECT_RATIO are already
// waiting on — don't re-guess a third number without that data.
const FLATTEN_STRENGTH = 0.6;

// Gaussian blur radius separating "high frequency" (weave, grain — anything
// finer than this) from "low frequency" (baked lighting/AO gradients and
// per-UV-island tone jumps — anything coarser), as a fraction of texture
// width. 40/4096 ≈ 0.00977 is the original tuning (verified: ~90% seam-gap
// reduction on a detailed/4096 texture). This USED to be a fixed pixel
// constant (40) applied unchanged regardless of texture size — meaning it
// ran proportionally ~2x too large on a 2048 "standard"-tier texture,
// bleeding further across UV island boundaries than intended. Measured
// directly: at a fixed sample-point seam, sigma=20 (proportionally correct
// for 2048) closed 90.7% of the gap; sigma=60 (proportionally oversized)
// only closed 77.9% — larger sigma is *worse* here, because atlas islands
// are arbitrarily adjacent in UV space, not 3D space, so a blur wide enough
// to approach island size starts averaging in unrelated neighboring islands
// rather than isolating each one's own baked tone. This is what "standard
// looks less clean than detailed" actually traced back to — a scaling bug,
// not a property of the standard tier's texture itself.
const BLUR_SIGMA_RATIO = 40 / 4096;

// ADDED 2026-09-01: the target for flattening. Originally a single global
// scalar (see the removed history below) — replaced because it conflates
// two different things that both show up as "low-frequency luminance
// variation": (a) baked-lighting/AO gradients WITHIN one UV island (the
// actual defect this function targets) and (b) genuine color/darkness
// differences BETWEEN islands that belong to different real materials
// (e.g. a light wood frame next to a dark fabric cushion — completely
// normal for a piece of furniture). Flattening (b) toward one global mean
// is not a bug fix, it's data loss: found live on "Wooden Dining Chair" —
// its real source photo has a dark charcoal woven cushion, but the
// shipped GLB's cushion came out light blue-gray, pulled up toward the
// mean set by the much larger light-wood area surrounding it. USDZ (no
// frequency separation at all, see lib/glbCompress.ts) kept the correct
// dark tone, which is why only the Android/GLB side looked wrong.
//
// The fix: flatten each pixel toward a *regional* mean (a second, much
// larger blur of the same low-frequency layer) instead of one image-wide
// scalar. A regional blur this size averages out the lighting gradient
// within a material's own UV island(s) without significantly pulling in
// a neighboring island's genuinely different material color — the same
// island-crossing risk BLUR_SIGMA_RATIO's own comment already describes,
// just needed at a *deliberately* larger radius here since the goal this
// time is "one material's own regional average," not "this exact pixel's
// immediate neighborhood." 8x the seam-detection blur radius is a
// starting point sized to stay smaller than this atlas's typical UV
// island extent (checked against the Wooden Dining Chair texture this
// bug was found on) — like every other constant in this file, a
// corrective adjustment pending real measured data across more objects,
// not a broadly-validated optimum.
const REGION_SIGMA_RATIO = BLUR_SIGMA_RATIO * 8;

export interface FrequencySeparationResult {
  image: Buffer;
  /** P99 local-gradient magnitude in the low-frequency layer, before flattening — a proxy for "how sharp is the worst baked-lighting jump" (real UV seams show up as exactly this: a sharp discontinuity in what should be a smoothly-varying lighting layer). */
  seamGapBefore: number;
  /** Same metric, after flattening. */
  seamGapAfter: number;
}

/**
 * Frequency separation on a texture atlas's luminance channel only (chroma
 * untouched, so material color/character is never altered) — the same
 * technique used in photo retouching to even out tone without losing fine
 * detail. Low-frequency luminance (baked per-UV-island lighting/AO — the
 * "dirty" look) is flattened toward the image's global mean; high-frequency
 * luminance (fabric weave, wood grain — the material's actual character) is
 * preserved untouched and recombined on top.
 *
 * Caller must catch: a failure here must fall back to the unprocessed
 * texture and still ship the model (see lib/glbCompress.ts) — this is a
 * quality pass, not something that may fail a paid generation.
 */
export async function frequencySeparate(input: Buffer): Promise<FrequencySeparationResult> {
  const img = sharp(input).removeAlpha();
  const { width, height } = await img.metadata();
  if (!width || !height) throw new Error("Could not read texture dimensions");

  const blurSigma = width * BLUR_SIGMA_RATIO;
  const regionSigma = width * REGION_SIGMA_RATIO;
  const raw = await img.clone().raw().toBuffer();
  const blurredRaw = await sharp(input).removeAlpha().blur(blurSigma).raw().toBuffer();
  const regionRaw = await sharp(input).removeAlpha().blur(regionSigma).raw().toBuffer();

  const n = width * height;
  const lum = new Float32Array(n);
  const low = new Float32Array(n);
  const regionLow = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    lum[i] = 0.2126 * raw[o] + 0.7152 * raw[o + 1] + 0.0722 * raw[o + 2];
    low[i] = 0.2126 * blurredRaw[o] + 0.7152 * blurredRaw[o + 1] + 0.0722 * blurredRaw[o + 2];
    regionLow[i] = 0.2126 * regionRaw[o] + 0.7152 * regionRaw[o + 1] + 0.0722 * regionRaw[o + 2];
  }

  const seamGapBefore = p99GradientMagnitude(low, width, height);

  // Flattening target is now per-pixel (regionLow), not one scalar for the
  // whole image — see REGION_SIGMA_RATIO's comment for why: it keeps each
  // material's own real average intact instead of pulling every island
  // toward a single mean the image's other, differently-colored materials
  // would otherwise dominate.
  const flattenedLow = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    flattenedLow[i] = regionLow[i] + (low[i] - regionLow[i]) * (1 - FLATTEN_STRENGTH);
  }
  const seamGapAfter = p99GradientMagnitude(flattenedLow, width, height);

  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < n; i++) {
    const high = lum[i] - low[i];
    const newLum = Math.max(1, flattenedLow[i] + high);
    const ratio = newLum / Math.max(1, lum[i]);
    const o = i * 3;
    out[o] = clamp255(raw[o] * ratio);
    out[o + 1] = clamp255(raw[o + 1] * ratio);
    out[o + 2] = clamp255(raw[o + 2] * ratio);
  }

  const image = await sharp(out, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  return { image, seamGapBefore, seamGapAfter };
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

// O(n) 99th-percentile via histogram — avoids sorting a multi-million-
// element array on every webhook delivery.
function p99GradientMagnitude(field: Float32Array, width: number, height: number): number {
  const BUCKETS = 1024;
  let maxGrad = 1;
  const grads = new Float32Array(width * height);
  let count = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = y * width + x;
      const dx = field[i + 1] - field[i];
      const dy = field[i + width] - field[i];
      const g = Math.abs(dx) + Math.abs(dy);
      grads[count++] = g;
      if (g > maxGrad) maxGrad = g;
    }
  }

  const hist = new Uint32Array(BUCKETS);
  for (let i = 0; i < count; i++) {
    const bucket = Math.min(BUCKETS - 1, Math.floor((grads[i] / maxGrad) * (BUCKETS - 1)));
    hist[bucket]++;
  }

  const target = count * 0.99;
  let cumulative = 0;
  for (let b = 0; b < BUCKETS; b++) {
    cumulative += hist[b];
    if (cumulative >= target) return (b / (BUCKETS - 1)) * maxGrad;
  }
  return maxGrad;
}
