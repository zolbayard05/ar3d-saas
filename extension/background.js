// MV3 service worker — creates the right-click menu item and stashes which
// image was clicked for popup.js to pick up. No content script:
// contexts:["image"] hands us info.srcUrl directly from the browser's own
// context-menu machinery, so there's nothing to inject into the page to
// get it. host_permissions in manifest.json is broad (http(s)://*/*) —
// popup.js's own image-fetch step is what actually needs that, to bypass
// per-site CORS when downloading an arbitrary product photo.

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
