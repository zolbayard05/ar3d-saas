import "server-only";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";

/**
 * Bakes a uniform scale factor directly into a GLB's root-node transforms so
 * the file's own geometry is real-world-correct on every AR path that
 * actually loads it (Android Scene Viewer, WebXR).
 *
 * Why this exists at all: `<model-viewer scale="...">` — what ARViewer.tsx
 * used to rely on — does not exist as a property on the primary model in
 * the installed @google/model-viewer version. Confirmed directly against
 * its own source: model-viewer.d.ts's `ModelViewerElementBase`/
 * `StagingInterface` have no `scale` member at all; the only `scale`
 * property anywhere in the package belongs to `ExtraModelElement`, the
 * unrelated `<model-viewer-model>` child element used for the multi-model
 * feature. Setting `scale` on the main `<model-viewer>` was silently a
 * no-op — for the on-page preview AND for AR — which is why models never
 * appeared at their configured size. There is no runtime attribute to
 * replace it with; the only thing every consumer (the in-page Three.js
 * scene, Android Scene Viewer, WebXR) actually reads is the GLB's own
 * geometry, so that geometry has to already be correct.
 *
 * iOS Quick Look loads the `ios-src` USDZ natively, outside the page
 * entirely (rule 9) — this function alone does nothing for it, since a
 * GLB-only bake never touches that file. See lib/usdzScale.ts (added
 * 2026-09-03) for the USDZ side of the same fix: a real gap existed here
 * for a while (no JS parser for USD's binary crate format, and Tripo's
 * `/models/convert` only ever converts its own original, un-rescaled task
 * output), closed by wrapping rather than editing — a new root layer that
 * `references` the original file and carries the scale, which never
 * requires understanding the original's binary content at all.
 *
 * Scales every ROOT node of the default scene (there is usually exactly
 * one), by multiplying each root's own local `scale` component — the same
 * operation Three.js's `object.scale.multiplyScalar(factor)` does on a
 * model's top-level Object3D, which commutes correctly with that node's own
 * rotation/position regardless of orientation since the factor is a single
 * uniform number applied equally on all three axes.
 */
export async function bakeGlbScale(input: Buffer, factor: number): Promise<Buffer> {
  // Both directions needed, not just the decoder: reading a Draco-
  // compressed GLB only requires decoding it into memory, but writeBinary
  // below re-encodes it right back to Draco on the way out (the mesh
  // primitives still reference KHR_draco_mesh_compression after the scale
  // edit, since only the node transform changed) — decoder-only threw
  // "[KHR_draco_mesh_compression] Please install extension dependency,
  // draco3d.encoder" on every real (Draco-compressed) model, caught live
  // when this had never actually succeeded end-to-end before: the webhook's
  // own sizeModel() call site swallows this in a try/catch and just leaves
  // scale unset, so it was failing silently there, and the user-facing
  // rescale route surfaced it as a generic "Failed to apply scale" error.
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    });
  const doc = await io.readBinary(input);

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) throw new Error("GLB has no scene");

  for (const node of scene.listChildren()) {
    const [x, y, z] = node.getScale();
    node.setScale([x * factor, y * factor, z * factor]);
  }

  return Buffer.from(await io.writeBinary(doc));
}
