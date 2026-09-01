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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "realify-3d" || !info.srcUrl) return;

  await chrome.storage.session.set({
    realifyPendingImage: {
      srcUrl: info.srcUrl,
      pageUrl: tab?.url ?? null,
      capturedAt: Date.now(),
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
