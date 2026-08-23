import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

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

// design/01-home-feed.png, design/06-feed-with-job.png: dark backdrop, not
// transparent — matches --color-bg in styles/themes.css. oklch(0.115 0 0)
// converted to sRGB via the OKLab reference matrices (the same method
// themes.css's own values were derived with, not eyeballed) = #050505.
const BACKDROP_HEX = "#050505";

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

const FIELD_OF_VIEW_DEG = 30;
// Multiplier on the tight geometric fit (see cameraDistanceForFit below) —
// "edge to edge" without literally clipping a vertex at the frame boundary.
const FRAME_MARGIN = 1.04;

const MAX_OUTPUT_LONG_EDGE = 1024;
const RENDER_TIMEOUT_MS = 15_000;

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
 * Renders a finished model to a dark-backdrop studio thumbnail — the actual
 * generated object, not the source photo (design/01, design/06). Runs
 * <model-viewer> (the same engine as the live AR viewer, so the thumbnail
 * and the real view never disagree) inside headless Chromium, screenshots
 * it, and returns the image. Never throws in a way that should fail a
 * generation — see the try/catch around every call site instead; this
 * function itself throws freely, callers are responsible for the fallback.
 */
export async function renderThumbnail({ glb, bbox, modelId }: RenderThumbnailInput): Promise<RenderThumbnailResult> {
  const aspectRatio = bbox.width / bbox.height; // output width:height — "the object's own aspect ratio", not square
  const outputWidth = aspectRatio >= 1 ? MAX_OUTPUT_LONG_EDGE : Math.round(MAX_OUTPUT_LONG_EDGE * aspectRatio);
  const outputHeight = aspectRatio >= 1 ? Math.round(MAX_OUTPUT_LONG_EDGE / aspectRatio) : MAX_OUTPUT_LONG_EDGE;

  const theta = BASE_THETA_DEG + seededThetaOffsetDeg(modelId);
  const distance = cameraDistanceForFit(
    [bbox.width / 2, bbox.height / 2, bbox.depth / 2],
    theta,
    BASE_PHI_DEG,
    aspectRatio,
  );

  const glbDataUrl = `data:model/gltf-binary;base64,${glb.toString("base64")}`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; width: ${outputWidth}px; height: ${outputHeight}px; background: ${BACKDROP_HEX}; overflow: hidden; }
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
    shadow-intensity="1"
    camera-controls="false"
    disable-zoom
    interaction-prompt="none"
    camera-orbit="${theta}deg ${BASE_PHI_DEG}deg ${distance.toFixed(5)}m"
    field-of-view="${FIELD_OF_VIEW_DEG}deg"
  ></model-viewer>
</body></html>`;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: outputWidth, height: outputHeight, deviceScaleFactor: 1 });
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

    const screenshot = await page.screenshot({ type: "webp", quality: 90 });
    return { image: Buffer.from(screenshot), width: outputWidth, height: outputHeight };
  } finally {
    await browser.close();
  }
}
