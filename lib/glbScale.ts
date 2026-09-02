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
 * iOS Quick Look is a separate, harder limitation this does NOT fix: it
 * loads the `ios-src` USDZ natively, outside the page entirely (rule 9),
 * with no channel for the page to influence it at all — scaling requires
 * the USDZ's own geometry to already be correct, and there is no local
 * USDZ authoring/editing tool in this stack (Tripo's `/models/convert` only
 * ever converts Tripo's own original, un-rescaled task output — it has no
 * "convert this modified GLB" mode). Left as a known platform gap, same
 * spirit as rule 9/10's other iOS AR caveats, rather than pretending a fix
 * exists where none is possible without a new USD toolchain.
 *
 * Scales every ROOT node of the default scene (there is usually exactly
 * one), by multiplying each root's own local `scale` component — the same
 * operation Three.js's `object.scale.multiplyScalar(factor)` does on a
 * model's top-level Object3D, which commutes correctly with that node's own
 * rotation/position regardless of orientation since the factor is a single
 * uniform number applied equally on all three axes.
 */
export async function bakeGlbScale(input: Buffer, factor: number): Promise<Buffer> {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
  const doc = await io.readBinary(input);

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!scene) throw new Error("GLB has no scene");

  for (const node of scene.listChildren()) {
    const [x, y, z] = node.getScale();
    node.setScale([x * factor, y * factor, z * factor]);
  }

  return Buffer.from(await io.writeBinary(doc));
}
