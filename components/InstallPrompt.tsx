"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Non-standard event — not in lib.dom.d.ts. Chrome/Edge/Android only.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IOS_HINT_DISMISSED_KEY = "ar3d-ios-install-hint-dismissed";

interface ClientDetection {
  standalone: boolean;
  isIOS: boolean;
  iosHintDismissed: boolean;
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's legacy, non-standard flag — matchMedia alone doesn't
    // reliably report standalone on older iOS versions.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// window/navigator/localStorage can't be read during SSR or the first
// client hydration pass (must match the server-rendered output), so this
// can't be a plain useState initializer or an effect+setState — React's
// react-hooks/set-state-in-effect rule specifically flags that pattern.
// useSyncExternalStore is the sanctioned replacement: getServerSnapshot
// covers SSR and the first hydration render (nothing shown, matching what
// the server sent), then React itself re-renders with the real client
// snapshot immediately after — no separate "mounted" flag needed.
let cachedDetection: ClientDetection | null = null;

function computeDetection(): ClientDetection {
  const next: ClientDetection = {
    standalone: isStandaloneDisplay(),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window),
    iosHintDismissed: window.localStorage.getItem(IOS_HINT_DISMISSED_KEY) === "1",
  };
  // Stable reference when nothing actually changed — useSyncExternalStore
  // re-renders whenever getSnapshot returns a new object, so a fresh
  // literal every call would loop forever.
  if (
    cachedDetection &&
    cachedDetection.standalone === next.standalone &&
    cachedDetection.isIOS === next.isIOS &&
    cachedDetection.iosHintDismissed === next.iosHintDismissed
  ) {
    return cachedDetection;
  }
  cachedDetection = next;
  return next;
}

// Must be a stable reference, same rule as computeDetection's cache below —
// a fresh literal on every call is exactly what React's own
// "getServerSnapshot should be cached" warning is flagging.
const SERVER_SNAPSHOT: ClientDetection = { standalone: false, isIOS: false, iosHintDismissed: true };

function getServerSnapshot(): ClientDetection {
  return SERVER_SNAPSHOT;
}

const detectionListeners = new Set<() => void>();

function subscribeDetection(callback: () => void) {
  detectionListeners.add(callback);
  // The one thing that can genuinely change post-mount without user
  // interaction on this page: the OS reporting the app just got installed.
  const mql = window.matchMedia("(display-mode: standalone)");
  const notify = () => detectionListeners.forEach((l) => l());
  mql.addEventListener("change", notify);
  return () => {
    detectionListeners.delete(callback);
    mql.removeEventListener("change", notify);
  };
}

/** Called from the iOS hint's dismiss button — invalidates the cached snapshot so every mounted instance re-reads localStorage. */
function dismissIosInstallHint() {
  window.localStorage.setItem(IOS_HINT_DISMISSED_KEY, "1");
  cachedDetection = null;
  detectionListeners.forEach((l) => l());
}

// Bar's own rendered height, measured live via getBoundingClientRect (py-2.5
// + text-small line height + the row's icon/button), not guessed: 52px.
// Reserve = the bar's own 92px offset from the viewport bottom (see
// overlayStyle below) + that height + 8px breathing room above it.
const INSTALL_BAR_RESERVE_PX = 152;

/**
 * HomeFeed/LibraryFeed read this to extend their existing bottom scroll
 * padding only while a bar is actually visible — set here (a DOM-sync
 * effect, not a setState-in-effect: this is exactly the "update an external
 * system with the latest state from React" case react-hooks/set-state-in-effect's
 * own guidance calls out as fine) rather than prop-drilled or reserved
 * unconditionally, so dismissing the bar gives that space straight back
 * instead of leaving a permanent gap under the last row.
 */
function setFeedBottomReserve(px: number) {
  document.documentElement.style.setProperty("--install-bar-reserve", `${px}px`);
}

/**
 * Two entirely different install paths, since only one of them is a real
 * browser API:
 *
 * - Android/Chrome fires `beforeinstallprompt`, which this captures and
 *   replays from our own button — Next's own PWA guide explicitly
 *   recommends against a custom trigger for cross-platform reasons, but
 *   Android is the one platform where the event actually exists to hook.
 * - iOS Safari never fires anything: there is no install API, no prompt,
 *   nothing to detect except "is this iOS and not already installed." The
 *   hint is the only thing that can exist here, dismissed once and
 *   remembered in localStorage (rather than a Button's session-only state)
 *   because there is no browser-native prompt to fall back on if we nag on
 *   every visit instead.
 */
export function InstallPrompt() {
  const { standalone, isIOS, iosHintDismissed } = useSyncExternalStore(
    subscribeDetection,
    computeDetection,
    getServerSnapshot,
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const showAndroidBar = !standalone && !!deferredPrompt;
  const showIosBar = !standalone && !deferredPrompt && isIOS && !iosHintDismissed;

  useEffect(() => {
    setFeedBottomReserve(showAndroidBar || showIosBar ? INSTALL_BAR_RESERVE_PX : 0);
    return () => setFeedBottomReserve(0);
  }, [showAndroidBar, showIosBar]);

  if (standalone) return null;

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstalling(false);
  }

  // Fixed overlay, not a normal-flow banner — see app/layout.tsx's own
  // comment on why body is h-dvh: nothing outside that chain should ever
  // consume flex space, in-flow or not.
  //
  // Bottom, not top: sits just above BottomNav's floating buttons (rule 39:
  // size-14 = 56px, offset env(safe-area-inset-bottom) + 24px), with a 12px
  // gap matching the nav's own inter-button spacing — 24 + 56 + 12 = 92px.
  // Inset from the side edges (not edge-to-edge) and rounded-card, so it
  // reads as a floating compact bar rather than a strip across the screen —
  // same "floating, never full-width" language rule 39 already uses for the
  // nav itself, not a second banner style.
  const overlayClass =
    "fixed inset-x-4 z-50 flex items-center justify-between gap-3 rounded-card bg-surface px-3 py-2.5 shadow-card";
  const overlayStyle = { bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" };

  if (showAndroidBar) {
    return (
      <div className={overlayClass} style={overlayStyle}>
        <p className="text-small text-text">Install AR3D for full-screen AR.</p>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="primary" loading={installing} onClick={() => void handleAndroidInstall()}>
            Install
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDeferredPrompt(null)}
            className="text-text-muted hover:text-text"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (showIosBar) {
    return (
      <div className={overlayClass} style={overlayStyle}>
        <p className="flex min-w-0 items-center gap-1 text-small text-text">
          Tap <Share2 size={14} className="shrink-0 text-text-muted" /> then “Add to Home Screen”
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismissIosInstallHint}
          className="shrink-0 text-text-muted hover:text-text"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  return null;
}
