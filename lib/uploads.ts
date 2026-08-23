/**
 * Shared between app/api/upload-url/route.ts (server-side enforcement) and
 * hooks/useUpload.ts (client-side pre-check, purely a UX nicety — the route
 * is the actual boundary per CLAUDE.md rule 30). One module so the two
 * checks can't silently drift apart.
 */

// Source photos only. HEIC is deliberately excluded even though it's the
// default iOS camera format — no browser can decode/preview it client-side
// and it's not a safe bet for the generation provider's input pipeline;
// revisit if Phase 3's provider confirms HEIC support.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export function isAllowedImageType(contentType: string): boolean {
  return contentType in ALLOWED_IMAGE_TYPES;
}
