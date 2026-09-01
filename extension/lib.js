// Pure helper functions used by popup.js, split out so they're testable
// with Node's built-in test runner (extension/lib.test.mjs) without a DOM
// or chrome.* mock. Loaded as a plain classic script in popup.html (before
// popup.js), same pattern as config.js — no build step either way. The
// module.exports guard at the bottom is what lets the *same* file run
// under both `<script>` (browser) and `node --test` (CommonJS-ish require)
// without needing two copies that could drift.

const ALLOWED_IMAGE_TYPES = { "image/jpeg": true, "image/png": true, "image/webp": true };

// Extensions the backend can never accept (mirrors lib/uploads.ts's
// ALLOWED_IMAGE_TYPES on the Next.js side — keep in sync). Checked against
// the URL path before ever fetching: Chrome's contextMenus API has no
// per-image-format filter, so "Realify — 3D болгох" shows up on every
// <img> regardless of format, including ones that can never succeed.
const KNOWN_UNSUPPORTED_EXTENSIONS = ["svg", "gif", "ico", "avif", "bmp", "tiff"];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // mirrors lib/uploads.ts — keep in sync

/**
 * Resolves the content-type to upload with. Prefers the browser's own
 * sniffed Blob.type; falls back to the URL's file extension for the
 * (common, e.g. some CDNs) case where a response has no/a wrong
 * Content-Type header. Returns null for anything not in
 * ALLOWED_IMAGE_TYPES either way.
 */
function guessContentType(blobType, srcUrl) {
  if (ALLOWED_IMAGE_TYPES[blobType]) return blobType;
  const ext = (srcUrl.split("?")[0].split(".").pop() || "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

function hasKnownUnsupportedExtension(srcUrl) {
  const ext = (srcUrl.split("?")[0].split(".").pop() || "").toLowerCase();
  return KNOWN_UNSUPPORTED_EXTENSIONS.includes(ext);
}

const RealifyLib = {
  ALLOWED_IMAGE_TYPES,
  KNOWN_UNSUPPORTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  guessContentType,
  hasKnownUnsupportedExtension,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = RealifyLib;
} else {
  self.RealifyLib = RealifyLib;
}
