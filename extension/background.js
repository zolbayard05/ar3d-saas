// MV3 service worker — creates the right-click menu item, stashes which
// image was clicked for popup.js to pick up, AND (added later, see below)
// independently tracks an in-flight generation so its result is never lost
// just because the popup closed. No content script:
// contexts:["image"] hands us info.srcUrl directly from the browser's own
// context-menu machinery, so there's nothing to inject into the page to
// get it. host_permissions in manifest.json is broad (http(s)://*/*) —
// popup.js's own image-fetch step is what actually needs that, to bypass
// per-site CORS when downloading an arbitrary product photo.
importScripts("config.js");

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

  const imgs = Array.from(document.querySelectorAll("img"));
  const candidates = new Map();

  function addCandidate(img) {
    const src = img.currentSrc || img.src;
    if (!src || src === frontSrc) return;
    if ((img.naturalWidth || img.width || 0) < MIN_DIMENSION) return;
    if ((img.naturalHeight || img.height || 0) < MIN_DIMENSION) return;
    if (!candidates.has(src)) candidates.set(src, { src, alt: img.alt || "" });
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

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "realify-track-start") {
    chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_PERIOD_MINUTES });
    void checkActiveGeneration();
  } else if (message?.type === "realify-track-stop") {
    chrome.alarms.clear(POLL_ALARM);
  }
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
