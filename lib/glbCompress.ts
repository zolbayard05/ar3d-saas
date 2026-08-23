import "server-only";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { draco, textureCompress, dedup, prune, getBounds } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import { frequencySeparate } from "@/lib/textureFreqSeparate";

// Native output at texture_quality "standard" (lib/tripo.ts's default) is
// 2048x2048 (confirmed by downloading Tripo's raw, pre-processing output
// directly), so this is a no-op cap, not an active downsize. See
// CLAUDE.md's decision log for why "standard" is final (decided three
// times) — texture tier is not up for relitigating without new evidence.
const TEXTURE_MAX_DIMENSION = 2048;

export interface GlbCompressResult {
  glb: Buffer;
  /** Set only if frequency separation actually ran (it may not — see the catch below). */
  seamGap?: { before: number; after: number };
  /**
   * Raw bounding-box size in the mesh's own (unscaled) units — glTF's
   * convention is 1 unit = 1 meter, but Tripo's output has no real-world
   * scale (rule 22), so these are NOT meters of anything real. Multiply by
   * the model's own `scale` column at display time to get an honest,
   * user-traceable centimeter figure — see migration 0008.
   */
  bbox?: { width: number; depth: number; height: number };
}

/**
 * Rule 21's GLB half: frequency-separated base color (removes baked per-UV-
 * island lighting while preserving weave/grain — see lib/textureFreqSeparate.ts),
 * Draco mesh compression, textures re-encoded at up to TEXTURE_MAX_DIMENSION.
 *
 * Not usable for USDZ: KHR_draco_mesh_compression is a glTF-only extension —
 * ARKit's USDZ format has no equivalent mesh-compression scheme. That side of
 * rule 21 relies entirely on constraining face_limit at generation time (see
 * lib/tripo.ts) — geometry, not texture data, is the dominant contributor to
 * output size (confirmed: ~350 KB of combined PBR textures at "standard"
 * quality still came with a 5.5 MB raw mesh).
 *
 * Frequency separation is a quality pass, not a correctness requirement — a
 * failure here must never cost a paid generation. It's caught and skipped
 * independently of the rest of this function (Draco/resize still run on the
 * original texture) — a *different*, coarser fallback around the whole call
 * to this function already exists in the webhook route for harder failures
 * (e.g. the wasm-loading bug this pipeline hit once already).
 */
export async function compressGlb(input: Buffer): Promise<GlbCompressResult> {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });

  const doc = await io.readBinary(input);

  // Computed on the pristine mesh, before draco()'s quantization runs below
  // — avoids any question of quantization affecting the measurement.
  let bbox: GlbCompressResult["bbox"];
  try {
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    if (scene) {
      const { min, max } = getBounds(scene);
      bbox = { width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
    }
  } catch (err) {
    console.warn("compressGlb: bounding-box extraction failed", err);
  }

  let seamGap: GlbCompressResult["seamGap"];
  try {
    for (const material of doc.getRoot().listMaterials()) {
      const baseColorTexture = material.getBaseColorTexture();
      const image = baseColorTexture?.getImage();
      if (!baseColorTexture || !image) continue;

      const result = await frequencySeparate(Buffer.from(image));
      baseColorTexture.setImage(result.image);
      seamGap = { before: result.seamGapBefore, after: result.seamGapAfter };
    }
  } catch (err) {
    console.warn("compressGlb: frequency separation failed, keeping unprocessed texture", err);
  }

  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "jpeg", quality: 85, resize: [TEXTURE_MAX_DIMENSION, TEXTURE_MAX_DIMENSION] }),
    draco({ method: "edgebreaker", quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10 }),
  );

  return { glb: Buffer.from(await io.writeBinary(doc)), seamGap, bbox };
}

export interface GlbValidationResult {
  valid: boolean;
  reason?: string;
  bbox?: { width: number; depth: number; height: number };
  /**
   * Set whenever bounds were computable (whether or not the model passed —
   * present on both an aspect-ratio rejection and a clean pass, absent only
   * when bounds themselves couldn't be measured at all, e.g. no geometry).
   * The caller logs this unconditionally so MAX_ASPECT_RATIO can eventually
   * move from a guess to a value backed by a real distribution instead of
   * the one sample it was sized against.
   */
  aspectRatio?: number;
}

// A real piece of furniture/decor essentially never has a bounding box more
// elongated than this in one axis vs. the shortest — a value this high
// almost always means the "object" isn't really a 3D object at all (e.g. a
// near-flat relief reconstructed from a source photo that wasn't a photo of
// anything three-dimensional to begin with — see the "512x512" placeholder-
// graphic case this constant was written to catch, 11.2:1). Starting guess,
// not measured against a real corpus of flagged generations yet — same
// status as DEFAULT_FACE_LIMIT above (see that comment): tune this number
// against real false positives/negatives as they show up in
// `refund_credit`'s failure_reason data, don't relitigate it without that.
const MAX_ASPECT_RATIO = 10;

// Meters, in Tripo's own unscaled mesh-unit space (rule 22 — not real-world
// meters). Guards against a literally flat/zero-thickness axis, which a pure
// aspect-ratio check alone wouldn't catch if the other two axes were also
// both near zero.
const MIN_EXTENT = 1e-4;

/**
 * Confirms the GLB we're about to serve as "ready" actually parses and
 * describes a plausible 3D object, rather than shipping — and charging a
 * credit for — a file a client can't usefully load. Runs on whatever bytes
 * are about to be uploaded (compressGlb's output, or its raw fallback), not
 * earlier in the pipeline, so it validates exactly what a user will receive.
 *
 * Deliberately narrow: this is a defensive floor against clearly-broken
 * output (unparseable, no geometry, non-finite/degenerate bounds, or
 * implausible proportions), not a "does this look like real furniture"
 * classifier — that would be guessing without evidence, which this project
 * avoids elsewhere (see DEFAULT_FACE_LIMIT, BLUR_SIGMA_RATIO). A model that
 * fails this is refunded as any other failure (rule 18), same as a
 * Tripo-side task failure — the cause (bad source photo vs. a provider
 * fluke) doesn't change that a user shouldn't pay for a file that can't
 * open.
 */
export async function validateGlb(input: Buffer): Promise<GlbValidationResult> {
  let doc;
  try {
    const io = new NodeIO()
      .registerExtensions([KHRDracoMeshCompression])
      .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
    doc = await io.readBinary(input);
  } catch (err) {
    return { valid: false, reason: `GLB failed to parse: ${err instanceof Error ? err.message : String(err)}` };
  }

  const primitives = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const vertexCount = primitives.reduce((sum, p) => sum + (p.getAttribute("POSITION")?.getCount() ?? 0), 0);
  if (primitives.length === 0 || vertexCount === 0) {
    return { valid: false, reason: "GLB has no geometry (zero primitives or vertices)" };
  }

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) {
    return { valid: false, reason: "GLB has no scene" };
  }

  const { min, max } = getBounds(scene);
  const extents = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (extents.some((extent) => !Number.isFinite(extent))) {
    return { valid: false, reason: `GLB bounding box is non-finite: ${extents.join(", ")}` };
  }
  if (extents.some((extent) => extent < MIN_EXTENT)) {
    return {
      valid: false,
      reason: `GLB bounding box is degenerate (near-zero extent on an axis): ${extents.map((e) => e.toFixed(6)).join(", ")}`,
    };
  }

  const aspectRatio = Math.max(...extents) / Math.min(...extents);
  if (aspectRatio > MAX_ASPECT_RATIO) {
    return {
      valid: false,
      aspectRatio,
      reason: `GLB bounding box aspect ratio ${aspectRatio.toFixed(1)}:1 exceeds ${MAX_ASPECT_RATIO}:1 (extents ${extents.map((e) => e.toFixed(4)).join(", ")}) — implausible proportions, likely reconstructed from an unusable source photo`,
    };
  }

  return { valid: true, aspectRatio, bbox: { width: extents[0], height: extents[1], depth: extents[2] } };
}
