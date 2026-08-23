import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev server blocks cross-origin requests for dev-only resources
  // (HMR, _next/static chunks) by default. Without this, loading the app
  // through a tunnel (e.g. ngrok, for testing Tripo webhooks / mobile AR)
  // silently drops several chunks with no error surfaced to the page - the
  // actual cause of an earlier bug that looked like a broken sign-in form
  // (hydration never completed, so the browser fell back to a native form
  // submit). Only wildcards ngrok's free-tier domain pattern; add other
  // tunnel hosts here if the tunnel URL changes.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app"],
  // draco3dgltf loads its .wasm file via a relative path computed from its
  // own module location at runtime. Left to Turbopack's default bundling,
  // that path gets rewritten to a bundler-internal virtual root
  // (observed: "C:\ROOT\node_modules\draco3dgltf\..."), which doesn't exist
  // on disk — the wasm load fails with ENOENT. Marking it (and the
  // @gltf-transform packages that pull it in) external keeps them as plain
  // node_modules `require()`s at runtime instead, so the path Draco computes
  // is the real one.
  // puppeteer-core / @sparticuz/chromium (lib/renderThumbnail.ts) resolve
  // their Chromium binary path at runtime the same way draco3dgltf resolves
  // its .wasm — external for the same reason, before hitting the same
  // bundler-rewritten-path failure rather than after.
  serverExternalPackages: [
    "draco3dgltf",
    "@gltf-transform/core",
    "@gltf-transform/functions",
    "@gltf-transform/extensions",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
};

export default nextConfig;
