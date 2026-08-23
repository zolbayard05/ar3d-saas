import "server-only";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { draco, textureCompress, dedup, prune } from "@gltf-transform/functions";
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

  return { glb: Buffer.from(await io.writeBinary(doc)), seamGap };
}
