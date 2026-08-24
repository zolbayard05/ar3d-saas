// App-shell cache — NOT a general offline/API cache. Bump CACHE_NAME when
// the shell itself changes (icon, manifest, this file); Next's hashed
// /_next/static/* filenames already bust themselves on every build, so this
// version bump only matters for the small hand-picked list below.
const CACHE_NAME = "ar3d-shell-v1";

// Deliberately just the public shell: the landing/login pages and static
// build assets. NOT /dashboard, /library, /models/*, or anything under
// /api/ — those are per-user or mutating, and this project has already hit
// real cross-user data bugs from trusting the wrong layer to scope things
// correctly (see CLAUDE.md rule 30 and this session's migration-0011 leak
// fix). A service worker cache is one more layer that could replay one
// account's HTML into another session on a shared device; the fix here is
// the same as everywhere else in this codebase — don't cache what you
// haven't explicitly scoped, rather than trust a blanket rule to be safe.
const SHELL_URLS = ["/", "/login", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isShellNavigation(url) {
  return url.pathname === "/" || url.pathname === "/login";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Hashed build output never changes under a given filename — cache-first
  // is safe and exactly what makes repeat loads instant.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => putInCache(request, res))),
    );
    return;
  }

  // Shell pages: serve the cached version instantly if we have one, then
  // silently refresh the cache from the network for next time. Both of
  // these routes are the same for every visitor (no session-specific
  // content), so there's nothing user-specific that could go stale wrong.
  if (isShellNavigation(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => putInCache(request, res))
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Everything else (authenticated pages, model detail, images from R2,
  // etc.) — no interception, plain network passthrough.
});

function putInCache(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}
