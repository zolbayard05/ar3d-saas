// Run with: node --test extension/lib.test.mjs
// No test framework/build step, matching the rest of this extension —
// Node's own built-in runner is plenty for a handful of pure functions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { guessContentType, hasKnownUnsupportedExtension, MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES } = require("./lib.js");

test("guessContentType trusts a Blob.type already in the allowlist", () => {
  assert.equal(guessContentType("image/png", "https://cdn.example.com/photo"), "image/png");
  assert.equal(guessContentType("image/webp", "https://cdn.example.com/photo.jpg"), "image/webp");
});

test("guessContentType falls back to the URL extension when Blob.type is missing/wrong", () => {
  assert.equal(guessContentType("", "https://cdn.example.com/chair.jpg"), "image/jpeg");
  assert.equal(guessContentType("application/octet-stream", "https://cdn.example.com/chair.jpeg"), "image/jpeg");
  assert.equal(guessContentType("", "https://cdn.example.com/chair.PNG"), "image/png");
  assert.equal(guessContentType("", "https://cdn.example.com/chair.webp?w=800"), "image/webp");
});

test("guessContentType returns null for anything unsupported", () => {
  assert.equal(guessContentType("image/svg+xml", "https://cdn.example.com/logo.svg"), null);
  assert.equal(guessContentType("", "https://cdn.example.com/logo.svg"), null);
  assert.equal(guessContentType("", "https://cdn.example.com/no-extension"), null);
});

test("hasKnownUnsupportedExtension flags the common non-photo formats", () => {
  for (const ext of ["svg", "gif", "ico", "avif", "bmp", "tiff"]) {
    assert.equal(hasKnownUnsupportedExtension(`https://cdn.example.com/x.${ext}`), true, ext);
  }
});

test("hasKnownUnsupportedExtension does not false-positive on real photo formats", () => {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    assert.equal(hasKnownUnsupportedExtension(`https://cdn.example.com/x.${ext}`), false, ext);
  }
});

test("hasKnownUnsupportedExtension ignores query strings when reading the extension", () => {
  assert.equal(hasKnownUnsupportedExtension("https://cdn.example.com/photo.jpg?size=large&fmt=gif"), false);
  assert.equal(hasKnownUnsupportedExtension("https://cdn.example.com/photo.gif?size=large"), true);
});

test("constants stay in sync with lib/uploads.ts's own values", () => {
  // Not a live import of lib/uploads.ts (that file is server-only and pulls
  // in Next.js-only globals) — this pins the two numbers/sets this file
  // must be kept manually consistent with, so a future change to one side
  // without the other fails loudly here instead of silently drifting.
  assert.equal(MAX_UPLOAD_BYTES, 20 * 1024 * 1024);
  assert.deepEqual(Object.keys(ALLOWED_IMAGE_TYPES).sort(), ["image/jpeg", "image/png", "image/webp"]);
});
