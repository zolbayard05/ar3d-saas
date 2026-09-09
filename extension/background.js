// MV3 service worker — creates the right-click menu item, stashes which
// image was clicked for popup.js to pick up, AND (added later, see below)
// independently tracks an in-flight generation so its result is never lost
// just because the popup closed. No content script:
// contexts:["image"] hands us info.srcUrl directly from the browser's own
// context-menu machinery, so there's nothing to inject into the page to
// get it. host_permissions in manifest.json is broad (http(s)://*/*) —
// this file's own upload/generate step (see "realify-submit" below) is
// what actually needs that, to bypass per-site CORS when downloading an
// arbitrary product photo.
importScripts("config.js", "lib.js");

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "realify-3d",
    title: "Realify — 3D болгох",
    contexts: ["image"],
  });
});

// Injected into the page via chrome.scripting.executeScript — MUST be a
// fully self-contained function (no closures over anything outside its own
// body/args): executeScript serializes it by source text and re-runs it
// inside the target page's own context, which shares nothing with this
// service worker's scope.
//
// Multi-view generation (lib/tripo.ts's multiview_to_model) wants 2-4 real
// angles of the SAME object, but this extension's whole interaction model is
// "right-click ONE image" — there's no way for the user to indicate "these
// four images are the same product" across separate clicks. Instead: most
// product pages already render the other angles somewhere nearby (a
// thumbnail rail next to the main image is the single most common e-commerce
// gallery pattern), so this scans for them automatically right after the
// click that captured the front image, and the popup lets the user pick
// which (if any) to include. Best-effort and additive only — finding nothing
// (or the injection itself being rejected, e.g. on a chrome:// page) just
// means the single-photo path runs exactly as before.
function realifyScanForGalleryImages(frontSrc) {
  const MIN_DIMENSION = 80; // filters out icons/spacers/tracking pixels
  const MAX_CANDIDATES = 8;

  // A gallery's own thumbnail rail very often re-serves the SAME photo the
  // user right-clicked at a different size for its first/hero thumbnail
  // (e.g. .../product-600x600.jpg next to .../product-150x150.jpg) — a
  // plain src-string comparison doesn't catch that, so the auto-picked
  // "extra angles" ended up burning a slot on a duplicate of front instead
  // of a genuinely different side (reported directly: "эхний 4-ийг л сонгож
  // байна, бүх талыг барьсан зураг сонгохгүй байна"). Strips the common
  // width/height suffix e-commerce CDNs put right before the file extension
  // (Shopify/WooCommerce/Magento all do some variant of "-300x300"/
  // "_600x600") and common resize query params, then dedups/excludes by
  // that normalized form instead of the raw URL. Best-effort heuristic, not
  // a real image-content comparison — true visual similarity would need
  // pixel access, which most product images being cross-origin with no CORS
  // header rules out (reading them back from a canvas throws).
  function normalizeImageUrl(url) {
    try {
      const u = new URL(url, location.href);
      const path = u.pathname.replace(/[-_]\d{2,4}x\d{0,4}(?=\.[a-z]{3,4}$)/i, "");
      const params = new URLSearchParams(u.search);
      ["w", "width", "h", "height", "size", "s", "quality", "q"].forEach((key) => params.delete(key));
      const query = params.toString();
      return `${u.origin}${path}${query ? "?" + query : ""}`;
    } catch {
      return url;
    }
  }

  const imgs = Array.from(document.querySelectorAll("img"));
  const candidates = new Map();
  const frontKey = normalizeImageUrl(frontSrc);

  function addCandidate(img) {
    const src = img.currentSrc || img.src;
    if (!src) return;
    const key = normalizeImageUrl(src);
    if (key === frontKey) return; // same photo as front at a different size — not a new angle
    if ((img.naturalWidth || img.width || 0) < MIN_DIMENSION) return;
    if ((img.naturalHeight || img.height || 0) < MIN_DIMENSION) return;
    // Keyed by the normalized form (so two sizes of the same OTHER photo
    // also collapse to one candidate), but the real src is what's stored —
    // that's what actually gets fetched later.
    if (!candidates.has(key)) candidates.set(key, { src, alt: img.alt || "" });
  }

  const front = imgs.find((img) => img.currentSrc === frontSrc || img.src === frontSrc);

  // Primary heuristic: walk up from the clicked image looking for the
  // nearest ancestor that contains a handful of OTHER images too — the
  // shape of almost every product-gallery thumbnail rail.
  if (front) {
    let node = front.parentElement;
    for (let depth = 0; depth < 6 && node; depth++) {
      const nearby = node.querySelectorAll("img");
      if (nearby.length >= 2 && nearby.length <= 24) {
        nearby.forEach(addCandidate);
        if (candidates.size > 0) break;
      }
      node = node.parentElement;
    }
  }

  // Fallback: images that share the clicked image's own URL directory —
  // catches galleries built without a shared DOM container (e.g. absolutely
  // positioned slides) as long as the CDN keeps product photos co-located.
  if (candidates.size < 2) {
    try {
      const frontUrl = new URL(frontSrc, location.href);
      const frontDir = frontUrl.pathname.slice(0, frontUrl.pathname.lastIndexOf("/") + 1);
      imgs.forEach((img) => {
        const src = img.currentSrc || img.src;
        if (!src) return;
        try {
          const u = new URL(src, location.href);
          if (u.origin === frontUrl.origin && frontDir.length > 1 && u.pathname.startsWith(frontDir)) {
            addCandidate(img);
          }
        } catch {
          // not a resolvable URL — skip
        }
      });
    } catch {
      // frontSrc itself didn't parse as a URL — nothing more to try
    }
  }

  return Array.from(candidates.values()).slice(0, MAX_CANDIDATES);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "realify-3d" || !info.srcUrl) return;

  // Best-effort — some pages (chrome://, the Chrome Web Store, a page that
  // hasn't finished loading) reject script injection outright. Losing this
  // never blocks the single-image path below, only the optional picker.
  let candidates = [];
  if (tab?.id != null) {
    try {
      const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: realifyScanForGalleryImages,
        args: [info.srcUrl],
      });
      candidates = result || [];
    } catch {
      candidates = [];
    }
  }

  await chrome.storage.session.set({
    realifyPendingImage: {
      srcUrl: info.srcUrl,
      pageUrl: tab?.url ?? null,
      capturedAt: Date.now(),
      candidates,
    },
  });

  chrome.action.setBadgeText({ text: "1" });
  chrome.action.setBadgeBackgroundColor({ color: "#d9793c" });

  try {
    // Available Chrome 116+, and only callable from a user-gesture chain —
    // the context-menu click itself is that gesture. Falls back silently
    // to the badge above if unsupported: the user can still just click the
    // toolbar icon.
    await chrome.action.openPopup();
  } catch {
    // Expected on older Chrome — no-op.
  }
});

// ---------------------------------------------------------------------
// Background generation tracking.
//
// popup.js already polls /api/extension/models/:id every ~2.5s for live
// progress while the popup is open — but a Chrome action popup is killed
// the instant the user clicks anywhere outside it (a real user report:
// "switched tabs, came back, had no way to tell if it was done"), which
// kills that in-page polling loop along with it. The generation itself
// keeps running server-side regardless, so the popup closing shouldn't
// mean losing track of it — this is the other half of that: an
// independent poll here, driven by chrome.alarms (the MV3-correct way to
// get woken up on a schedule even after this service worker itself has
// been terminated for inactivity, which setInterval/setTimeout can't
// survive), that keeps checking and raises a badge + native OS
// notification the moment it resolves, regardless of what the user is
// doing or looking at.
//
// Deliberately a *supplement*, not a replacement, for popup.js's own
// polling: while the popup happens to be open, both may check in
// parallel (a harmless, idempotent GET, at most one extra request every
// 30s) — simpler and lower-risk than tearing out the working in-popup
// polling loop to make this the sole source of truth.
const POLL_ALARM = "realify-poll";
// 30 seconds — Chrome clamps repeating alarms to this floor for
// Web-Store-installed extensions (unpacked/dev mode alone permits finer
// intervals, which would silently stop working the moment this ships),
// and it's plenty fine against a 30-100s generation.
const POLL_PERIOD_MINUTES = 0.5;

async function getToken() {
  const { realifyToken } = await chrome.storage.local.get("realifyToken");
  return realifyToken || null;
}

// ---------------------------------------------------------------------
// Generation submission (2026-09-09) — moved here from popup.js after a
// real user report: closing the popup (any click outside it, e.g.
// switching back to the shopping tab the photo came from) while a
// submission's own upload/generate round trip was still in flight killed
// it silently — popup.js's execution context, including any in-flight
// fetch(), is destroyed the instant the popup closes. Reopening then
// found none of realifyActiveGeneration/realifyLastResult/realifyLastError
// set, and fell through to the still-present realifyPendingImage, showing
// "ready to generate" again — risking a genuine second paid generation for
// the same photo. Running the whole sequence here instead means it
// survives popup closure the same way checkActiveGeneration's own
// alarm-driven tracking below already does; only the *handoff message*
// from popup.js needs the popup to still be open, not the work itself.
// ---------------------------------------------------------------------

async function bgApi(path, options, token) {
  const res = await fetch(`${REALIFY_API_BASE}${path}`, {
    ...options,
    headers: { ...(options?.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // Not popup.js's api(): there's no popup state to redirect to
    // "need-token" here. Clearing the token is enough — the next boot()
    // (whenever the popup is next opened) checks it first, ahead of any
    // of the session-storage keys this function touches.
    await chrome.storage.local.remove("realifyToken");
    throw new Error("unauthorized");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Алдаа гарлаа (${res.status})`);
  return body;
}

// DOM-free equivalent of popup.js's readImageDimensions — `new Image()`
// isn't available in a service worker, `createImageBitmap` is.
async function bgReadImageDimensions(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const dims = { width: bitmap.width || null, height: bitmap.height || null };
    bitmap.close();
    return dims;
  } catch {
    return { width: null, height: null };
  }
}

// Best-effort upload of one additional angle — mirrors popup.js's own
// downloadAndUploadImage exactly, built on the two helpers above instead.
async function bgDownloadAndUploadImage(url, token) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const contentType = RealifyLib.guessContentType(blob.type, url);
    if (!contentType) return null;
    if (blob.size > RealifyLib.MAX_UPLOAD_BYTES) return null;

    const { width, height } = await bgReadImageDimensions(blob);
    const presign = await bgApi(
      "/api/extension/upload-url",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType, contentLength: blob.size }) },
      token,
    );
    const putRes = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
    if (!putRes.ok) return null;
    return { key: presign.key, width, height };
  } catch {
    return null;
  }
}

// The actual submission — same sequence popup.js's old startGeneration()
// ran inline, unchanged step for step, just running here instead.
async function handleSubmit({ srcUrl, selectedAngles }) {
  await chrome.storage.session.set({ realifySubmitting: { srcUrl, startedAt: Date.now() } });

  try {
    const token = await getToken();
    if (!token) throw new Error("unauthorized");

    if (RealifyLib.hasKnownUnsupportedExtension(srcUrl)) {
      throw new Error(
        "Энэ зургийн формат дэмжигдэхгүй (JPEG/PNG/WEBP л дэмжигдэнэ). Бүтээгдэхүүний жинхэнэ зурган дээр right-click хийнэ үү.",
      );
    }

    let imgRes;
    try {
      imgRes = await fetch(srcUrl);
    } catch {
      throw new Error(
        "Энэ зургийг татаж чадсангүй (сүлжээ/CORS). Extension шинэчлэгдсэн эсэхийг chrome://extensions дээрээс шалгаад дахин оролдоно уу.",
      );
    }
    if (!imgRes.ok) throw new Error("Энэ зургийг татаж чадсангүй. Өөр зураг дээр оролдоно уу.");
    const blob = await imgRes.blob();

    const contentType = RealifyLib.guessContentType(blob.type, srcUrl);
    if (!contentType) throw new Error("Дэмжигдэхгүй зургийн формат (JPEG/PNG/WEBP л дэмжигдэнэ).");
    if (blob.size > RealifyLib.MAX_UPLOAD_BYTES) {
      throw new Error(
        `Зураг хэт том байна (${(blob.size / 1024 / 1024).toFixed(1)}MB, ${RealifyLib.MAX_UPLOAD_BYTES / 1024 / 1024}MB хүртэл). Өөр зураг дээр оролдоно уу.`,
      );
    }

    const { width, height } = await bgReadImageDimensions(blob);

    const presign = await bgApi(
      "/api/extension/upload-url",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType, contentLength: blob.size }) },
      token,
    );
    const putRes = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
    if (!putRes.ok) throw new Error("Хуулахад алдаа гарлаа.");

    const uploads = [{ key: presign.key, width, height }];
    for (const url of selectedAngles || []) {
      const uploaded = await bgDownloadAndUploadImage(url, token);
      if (uploaded) uploads.push(uploaded);
    }

    let sourceImageKey = uploads[0].key;
    let sourceImageWidth = uploads[0].width;
    let sourceImageHeight = uploads[0].height;
    let sourceImageKeyLeft;
    let sourceImageKeyBack;
    let sourceImageKeyRight;
    let singleAngleNote = false;

    if (uploads.length > 1) {
      try {
        const classifyBody = await bgApi(
          "/api/extension/classify-angles",
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: uploads.map((u) => u.key) }) },
          token,
        );
        const slots = classifyBody.slots;
        if (slots?.front) {
          sourceImageKey = slots.front;
          sourceImageKeyLeft = slots.left || undefined;
          sourceImageKeyBack = slots.back || undefined;
          sourceImageKeyRight = slots.right || undefined;
          const frontUpload = uploads.find((u) => u.key === sourceImageKey);
          sourceImageWidth = frontUpload ? frontUpload.width : sourceImageWidth;
          sourceImageHeight = frontUpload ? frontUpload.height : sourceImageHeight;
        } else {
          singleAngleNote = true;
        }
      } catch (err) {
        if (err.message === "unauthorized") throw err;
        singleAngleNote = true;
      }
    }

    const gen = await bgApi(
      "/api/extension/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageKey,
          idempotencyKey: crypto.randomUUID(),
          sourceImageWidth,
          sourceImageHeight,
          sourceImageKeyLeft,
          sourceImageKeyBack,
          sourceImageKeyRight,
        }),
      },
      token,
    );

    // Same handoff realify-track-start used to do from popup.js — now done
    // directly, plus an immediate check rather than waiting for the first
    // 30s alarm tick.
    await chrome.storage.session.set({
      realifyActiveGeneration: { modelId: gen.modelId, startedAt: Date.now(), singleAngleNote },
    });
    await chrome.storage.session.remove(["realifySubmitting", "realifyPendingImage"]);
    chrome.action.setBadgeText({ text: "" });
    chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_PERIOD_MINUTES });
    void checkActiveGeneration();

    return { ok: true, modelId: gen.modelId, singleAngleNote };
  } catch (err) {
    await chrome.storage.session.remove("realifySubmitting");
    if (err.message === "unauthorized") {
      // Token already cleared (bgApi, or the check above) — the next
      // boot() lands on "need-token" on its own; no error to show on top.
      return { ok: false, error: "unauthorized" };
    }
    const message = err.message || "Алдаа гарлаа.";
    // Deliberately does NOT touch realifyPendingImage — never silently
    // discard the user's captured photo without their own explicit
    // dismiss (resetToIdle() in popup.js already clears both together
    // when the user actually acts). Genuine improvement over the old
    // inline flow: a pre-submission failure's message used to live only
    // in the popup's own in-memory state and was lost if the popup closed
    // right after; now it survives.
    await chrome.storage.session.set({ realifyLastError: message });
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#e5484d" });
    return { ok: false, error: message };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "realify-track-start") {
    chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_PERIOD_MINUTES });
    void checkActiveGeneration();
    return false;
  }
  if (message?.type === "realify-track-stop") {
    chrome.alarms.clear(POLL_ALARM);
    return false;
  }
  if (message?.type === "realify-submit") {
    handleSubmit(message).then(sendResponse);
    return true; // keep the channel open for the async sendResponse above
  }
  return false;
});

// Also resumes tracking if the browser (and this service worker with it)
// restarted while a generation was still in flight — otherwise a
// mid-generation browser restart would silently drop tracking with no
// alarm ever re-armed to pick it back up.
chrome.runtime.onStartup.addListener(() => {
  void checkActiveGeneration();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) void checkActiveGeneration();
});

async function checkActiveGeneration() {
  const { realifyActiveGeneration } = await chrome.storage.session.get("realifyActiveGeneration");
  if (!realifyActiveGeneration) {
    chrome.alarms.clear(POLL_ALARM);
    return;
  }

  const token = await getToken();
  if (!token) {
    chrome.alarms.clear(POLL_ALARM);
    return;
  }

  let body;
  try {
    const res = await fetch(`${REALIFY_API_BASE}/api/extension/models/${realifyActiveGeneration.modelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return; // transient error — next alarm tick retries
    body = await res.json();
  } catch {
    return; // network blip — next alarm tick retries
  }

  if (body.status === "ready") {
    await chrome.storage.session.remove("realifyActiveGeneration");
    await chrome.storage.session.set({ realifyLastResult: body });
    chrome.alarms.clear(POLL_ALARM);
    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#3ba55c" });
    notify("Таны 3D загвар бэлэн боллоо!", "Дарж нээгээд утсандаа AR-аар үзээрэй.");
  } else if (body.status === "failed") {
    await chrome.storage.session.remove("realifyActiveGeneration");
    await chrome.storage.session.set({ realifyLastError: "Үүсгэлт амжилтгүй боллоо. Кредит буцаагдсан." });
    chrome.alarms.clear(POLL_ALARM);
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#e5484d" });
    notify("Үүсгэлт амжилтгүй боллоо", "Кредит буцаагдсан. Дахин оролдоно уу.");
  }
  // else: still pending/processing — leave the alarm running for the next tick.
}

function notify(title, message) {
  chrome.notifications.create(`realify-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
  });
}

chrome.notifications.onClicked.addListener(async () => {
  try {
    await chrome.action.openPopup();
  } catch {
    // Expected outside a fresh user-gesture chain on some Chrome versions.
  }
});
