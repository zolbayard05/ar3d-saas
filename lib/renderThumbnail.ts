import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import sharp, { type OverlayOptions } from "sharp";
import { MODEL_CARD_ASPECT_RATIO } from "@/lib/models";

export interface RenderThumbnailInput {
  glb: Buffer;
  /** Same units as lib/glbCompress.ts's bbox — Tripo's own unscaled mesh units, not real meters (rule 22). */
  bbox: { width: number; depth: number; height: number };
  /** Seeds the per-model camera-angle variation — same model always renders the same way. */
  modelId: string;
}

export interface RenderThumbnailResult {
  image: Buffer;
  width: number;
  height: number;
}

// model-viewer's own bundle, inlined as a plain <script> so the render page
// never depends on a CDN being up — this file already ships in
// node_modules as a project dependency (rule 11's ARViewer.tsx uses the
// same package), read once per cold start, not per render.
const MODEL_VIEWER_UMD_JS = readFileSync(
  join(process.cwd(), "node_modules/@google/model-viewer/dist/model-viewer-umd.min.js"),
  "utf8",
);

// A natural, slightly-elevated three-quarter product-photo angle, not
// straight-on and not top-down. phi=90 is model-viewer's eye-level; leaning
// under 90 looks down at the object slightly.
const BASE_THETA_DEG = 35;
const BASE_PHI_DEG = 72;

// "Vary the key light angle per model within the fixed setup": the
// environment (lib below, environment-image="neutral") is a fixed IBL map,
// not a movable point light, so there's no literal light-angle attribute to
// jitter. The equivalent within what model-viewer actually exposes is
// rotating the camera's azimuth a small deterministic amount per model —
// this changes which side of the object catches the environment's
// highlight, which is the actual visual effect "vary the light angle" is
// asking for, achieved by the only lever a fixed-IBL setup has.
const THETA_JITTER_DEG = 15;

// Kept at model-viewer's own eye-level-ish value, NOT widened for a more
// "dramatic"/close-up look (tried during development, reverted): a wider
// field of view introduces real perspective distortion — near parts of the
// object read bigger relative to far parts than they actually are — which
// is exactly wrong for a product this app is otherwise careful to represent
// at honest real-world proportions (rule 22, the whole scale/bbox/Gemini
// system). 30° keeps the object's own proportions undistorted.
const FIELD_OF_VIEW_DEG = 30;
// Multiplier on the tight geometric fit (see cameraDistanceForFit below) —
// "edge to edge" without literally clipping a vertex at the frame boundary.
const FRAME_MARGIN = 1.04;

const MAX_OUTPUT_LONG_EDGE = 1024;
const RENDER_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// 2026-09-03 — studio backdrop + floor reflection, redone as a 2D
// post-process (sharp) rather than anything baked into the 3D scene.
//
// model-viewer renders on a fully transparent background here (no CSS
// backdrop at all) and the screenshot is captured as PNG with alpha
// preserved — the ONLY thing this file gets from Puppeteer is the object's
// own silhouette. Everything else (the warm/cool gradient, the floor
// reflection) is composited afterward with sharp, which is dramatically
// easier to get right than trying to fake a reflective floor material
// inside the GLB's own scene graph: two SVG-rasterized layers plus a
// flip+fade+blur of the object itself, no 3D geometry involved.
//
// Colors are a first-pass match to a specific reference screenshot (product
// asked to match it closely, explicitly waiving the "no accent hue"
// convention styles/themes.css otherwise holds everywhere else in the app —
// this is the one place in the codebase that isn't achromatic) — tuned live
// against real renders, not sampled pixel-for-pixel.
// 2026-09-03 (v2): direction reversed per direct feedback against a second
// reference image — dark at the TOP, brightening toward a glossy-looking
// floor at the BOTTOM (classic studio product-photo lighting: dark
// backdrop, lit table), not the warm-hotspot-at-top version tried first.
const GRADIENT_TOP_HEX = "#050505";
const GRADIENT_MID_HEX = "#1c1a1c";
const GRADIENT_FLOOR_HEX = "#6b625d";
const GRADIENT_FLOOR_GLOW_HEX = "#a89d94";

// 2026-09-03 (v3): the final image is now ALWAYS exactly
// MODEL_CARD_ASPECT_RATIO (lib/models.ts — the same fixed ratio every
// ModelCard renders at) instead of the object's own bbox-derived ratio.
// Rendering at the object's own shape left a mismatch between a narrow/tall
// object's image and the fixed-ratio card containing it — object-contain
// then had to letterbox the sides, which read as "not filling the card"
// (reported directly against a tall vase). Framing the object into only
// the TOP fraction of an already-card-shaped canvas — rather than
// rendering at the object's shape and stretching the canvas afterward —
// means the delivered image's own aspect ratio always matches the card
// exactly, so object-contain finds a perfect fit with zero letterboxing on
// any side, for every object shape, while the object itself still renders
// at its own true, undistorted proportions (cameraDistanceForFit fits it
// into that fraction, never stretches it).
//
// 2026-09-03 (v4): object anchored flush at the top read as sitting too
// high once the canvas went square (reported directly) — TOP_MARGIN_FRACTION
// adds empty room above matching what's left below for the reflection, so
// the object's own vertical midpoint always lands at the canvas's true
// center: TOP_MARGIN_FRACTION + OBJECT_AREA_HEIGHT_FRACTION / 2 = 0.5.
// (v5): object sized up further per direct feedback ("bring it closer/
// bigger") — both re-solved from that same centering equation, not just
// OBJECT_AREA_HEIGHT_FRACTION bumped alone, or the object would drift
// back off-center.
const TOP_MARGIN_FRACTION = 0.14;
const OBJECT_AREA_HEIGHT_FRACTION = 0.72;
// How opaque the reflection starts (right at the object's own base), fading
// to fully transparent — kept low and blurred (REFLECTION_BLUR_PX below) so
// it reads as a soft, out-of-focus floor reflection, not a second copy of
// the object. Both tuned live, down from an initial pass that read as too
// strong/distinct a "shadow" on real renders.
const REFLECTION_START_OPACITY = 0.13;
const REFLECTION_BLUR_PX = 5;

function seededThetaOffsetDeg(modelId: string): number {
  const hash = createHash("sha256").update(modelId).digest();
  // First 2 bytes -> [0, 65535] -> [-1, 1] -> [-THETA_JITTER_DEG, THETA_JITTER_DEG]
  const unit = (hash.readUInt16BE(0) / 0xffff) * 2 - 1;
  return unit * THETA_JITTER_DEG;
}

/**
 * Minimum camera distance (in the model's own local units) that keeps every
 * corner of the AABB inside the frame, for a camera at the given spherical
 * orbit angles and a fixed vertical field of view. Derived directly, not a
 * guessed zoom factor: model-viewer's own "auto" distance is a bounding-
 * SPHERE fit (safe at any orbit angle, since interactive rotation can reach
 * any of them), which is why its default framing leaves visible margin at
 * any one fixed angle — this instead fits the actual AABB silhouette at the
 * one angle this render will ever use.
 *
 * Math: for a world point P (relative to the target/origin) and a camera at
 * target + dir*d looking back at target, P's offset along the camera's
 * right/up axes doesn't depend on d (both are perpendicular to dir); its
 * depth from the camera does: depth = d - dot(P, dir). P stays inside the
 * horizontal half-angle exactly when depth >= |right-offset| / tan(hFov/2),
 * i.e. d >= dot(P, dir) + |right-offset| / tan(hFov/2) — solved per corner,
 * per axis, and maxed over all 8 corners.
 */
function cameraDistanceForFit(
  halfExtents: [number, number, number],
  thetaDeg: number,
  phiDeg: number,
  aspectRatio: number,
): number {
  const theta = (thetaDeg * Math.PI) / 180;
  const phi = (phiDeg * Math.PI) / 180;

  // dir: unit vector from target toward the camera (model-viewer's own
  // theta-around-Y / phi-from-+Y spherical convention).
  const dir: [number, number, number] = [Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)];

  const worldUp: [number, number, number] = [0, 1, 0];
  const right = normalize(cross(dir, worldUp)); // cross(dir, worldUp) ⟂ dir; forward = -dir, so this is also ⟂ forward
  const camUp = cross(right, dir);

  const vFov = (FIELD_OF_VIEW_DEG * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspectRatio);
  const tanH = Math.tan(hFov / 2);
  const tanV = Math.tan(vFov / 2);

  const [hx, hy, hz] = halfExtents;
  let dMin = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner: [number, number, number] = [sx * hx, sy * hy, sz * hz];
        const alongDir = dot(corner, dir);
        const alongRight = Math.abs(dot(corner, right));
        const alongUp = Math.abs(dot(corner, camUp));
        dMin = Math.max(dMin, alongDir + alongRight / tanH, alongDir + alongUp / tanV);
      }
    }
  }
  return dMin * FRAME_MARGIN;
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
}

async function launchBrowser(): Promise<Browser> {
  // Vercel/AWS Lambda set this; nothing else does, including local dev —
  // used to pick the Linux-only serverless Chromium build there and a real
  // local Chrome install everywhere else (@sparticuz/chromium's binary
  // can't run on this Windows dev machine at all).
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const localChrome =
    process.env.CHROME_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  return puppeteer.launch({ executablePath: localChrome, headless: true });
}

/**
 * Finds the object's real bottom edge in a transparent-background render —
 * the last pixel row (scanning up from the canvas floor) with any
 * meaningfully non-transparent pixel. That row is where the floor
 * reflection below should start (see buildReflection), rather than a
 * guessed offset — camera angle/model shape both change where the object's
 * lowest point actually lands in the frame.
 */
async function findBottomEdge(objectPng: Buffer): Promise<{ width: number; height: number; bottomEdge: number }> {
  const { data, info } = await sharp(objectPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let bottomEdge = height - 1;
  outer: for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x += 4) {
      if (data[(y * width + x) * channels + 3] > 10) {
        bottomEdge = y;
        break outer;
      }
    }
  }
  return { width, height, bottomEdge };
}

/** The warm/cool studio-gradient backdrop — see this file's header comment for why it's chromatic. */
function buildBackgroundSvg(width: number, canvasHeight: number): Buffer {
  return Buffer.from(`
    <svg width="${width}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${GRADIENT_TOP_HEX}"/>
          <stop offset="60%" stop-color="${GRADIENT_MID_HEX}"/>
          <stop offset="100%" stop-color="${GRADIENT_FLOOR_HEX}"/>
        </linearGradient>
        <radialGradient id="floorGlow" cx="50%" cy="97%" r="65%">
          <stop offset="0%" stop-color="${GRADIENT_FLOOR_GLOW_HEX}" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="${GRADIENT_FLOOR_GLOW_HEX}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="35%" r="75%">
          <stop offset="45%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#base)"/>
      <rect width="100%" height="100%" fill="url(#floorGlow)"/>
      <rect width="100%" height="100%" fill="url(#vignette)"/>
    </svg>`);
}

/**
 * Mirrors the object across its own bottom edge, fades it out over the
 * canvas room below that edge, and softens it with a blur — a classic
 * flip+fade "floor reflection," not a real physically-based one, which
 * this GLB-agnostic 2D pipeline has no way to compute. Returns null when
 * there's no usable room for one (reflectionSourceHeight would be ~0).
 */
async function buildReflection(
  objectPng: Buffer,
  width: number,
  bottomEdge: number,
  canvasHeight: number,
): Promise<Buffer | null> {
  const reflectionSourceHeight = Math.min(bottomEdge + 1, canvasHeight - bottomEdge - 1);
  if (reflectionSourceHeight <= 4) return null;

  const sourceTop = bottomEdge + 1 - reflectionSourceHeight;
  const mirrored = await sharp(objectPng)
    .extract({ left: 0, top: sourceTop, width, height: reflectionSourceHeight })
    .flip()
    .toBuffer();

  const fadeMask = Buffer.from(`
    <svg width="${width}" height="${reflectionSourceHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity="${REFLECTION_START_OPACITY}"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#fade)"/>
    </svg>`);

  return sharp(mirrored)
    .composite([{ input: fadeMask, blend: "dest-in" }])
    .blur(REFLECTION_BLUR_PX)
    .toBuffer();
}

/**
 * Renders a finished model to a studio-style thumbnail with a warm/cool
 * gradient backdrop and a soft floor reflection — the actual generated
 * object, not the source photo (design/01, design/06). Runs <model-viewer>
 * (the same engine as the live AR viewer, so the thumbnail and the real
 * view never disagree) inside headless Chromium on a transparent
 * background, then composites the backdrop/reflection with sharp. Never
 * throws in a way that should fail a generation — see the try/catch around
 * every call site instead; this function itself throws freely, callers are
 * responsible for the fallback.
 */
export async function renderThumbnail({ glb, bbox, modelId }: RenderThumbnailInput): Promise<RenderThumbnailResult> {
  // MODEL_CARD_ASPECT_RATIO <= 1 (square or portrait), so height is always
  // the long (or equal) edge.
  const canvasHeight = MAX_OUTPUT_LONG_EDGE;
  const canvasWidth = Math.round(MAX_OUTPUT_LONG_EDGE * MODEL_CARD_ASPECT_RATIO);
  const topMargin = Math.round(canvasHeight * TOP_MARGIN_FRACTION);
  const objectAreaHeight = Math.round(canvasHeight * OBJECT_AREA_HEIGHT_FRACTION);
  // What cameraDistanceForFit actually fits the bbox into — a shorter slice
  // of the full card canvas, positioned with topMargin above it and
  // whatever's left below reserved for the reflection/floor.
  const objectFrameAspectRatio = canvasWidth / objectAreaHeight;

  const theta = BASE_THETA_DEG + seededThetaOffsetDeg(modelId);
  const distance = cameraDistanceForFit(
    [bbox.width / 2, bbox.height / 2, bbox.depth / 2],
    theta,
    BASE_PHI_DEG,
    objectFrameAspectRatio,
  );

  const glbDataUrl = `data:model/gltf-binary;base64,${glb.toString("base64")}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; width: ${canvasWidth}px; height: ${objectAreaHeight}px; background: transparent; overflow: hidden; }
  model-viewer { width: 100%; height: 100%; --poster-color: transparent; }
</style>
<script>${MODEL_VIEWER_UMD_JS}</script>
</head>
<body>
  <model-viewer
    id="mv"
    src="${glbDataUrl}"
    environment-image="neutral"
    exposure="1"
    shadow-intensity="0.6"
    shadow-softness="1"
    camera-controls="false"
    disable-zoom
    interaction-prompt="none"
    camera-orbit="${theta}deg ${BASE_PHI_DEG}deg ${distance.toFixed(5)}m"
    field-of-view="${FIELD_OF_VIEW_DEG}deg"
  ></model-viewer>
</body></html>`;

  const browser = await launchBrowser();
  let objectPng: Buffer;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: canvasWidth, height: objectAreaHeight, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    await page.evaluate(
      (timeoutMs) =>
        new Promise<void>((resolve, reject) => {
          const mv = document.getElementById("mv") as HTMLElement & { loaded?: boolean };
          const timer = setTimeout(() => reject(new Error("model-viewer load timed out")), timeoutMs);
          if (mv.loaded) {
            clearTimeout(timer);
            resolve();
            return;
          }
          mv.addEventListener(
            "load",
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        }),
      RENDER_TIMEOUT_MS,
    );

    // model-viewer settles its camera over a couple of animation frames
    // after `load` fires; a short fixed wait is simpler and more reliable
    // here than instrumenting its internal camera-change events for a
    // one-shot render that's never interactive.
    await new Promise((resolve) => setTimeout(resolve, 300));

    objectPng = Buffer.from(await page.screenshot({ type: "png", omitBackground: true }));
  } finally {
    await browser.close();
  }

  // bottomEdge is relative to objectPng's own coordinate space; the object
  // is composited at top:topMargin below, so its bottom edge in FINAL
  // canvas coordinates is offset by that same margin.
  const { bottomEdge: bottomEdgeInObject } = await findBottomEdge(objectPng);
  const bottomEdge = topMargin + bottomEdgeInObject;

  const background = await sharp(buildBackgroundSvg(canvasWidth, canvasHeight)).png().toBuffer();
  const reflection = await buildReflection(objectPng, canvasWidth, bottomEdgeInObject, canvasHeight - topMargin);

  const layers: OverlayOptions[] = [];
  if (reflection) layers.push({ input: reflection, left: 0, top: bottomEdge + 1 });
  layers.push({ input: objectPng, left: 0, top: topMargin });

  const image = await sharp(background).composite(layers).webp({ quality: 90 }).toBuffer();
  return { image, width: canvasWidth, height: canvasHeight };
}
