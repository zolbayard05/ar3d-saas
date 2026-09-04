// No framework, no build step — matches how the rest of this extension is
// plain script files. One small state machine rendered into #app.

// guessContentType/hasKnownUnsupportedExtension/MAX_UPLOAD_BYTES live in
// lib.js (loaded before this file in popup.html) — split out purely so
// they're unit-testable (extension/lib.test.mjs) without a DOM/chrome.*
// mock; nothing here should redefine them.
const POLL_INTERVAL_MS = 2500;
// The real pipeline is a sequential GLB+USDZ generation (see
// app/api/webhooks/tripo/route.ts), commonly 3-5 minutes and sometimes more
// with a QA regen retry — kept at 3 minutes for now regardless (not
// re-tuned as part of this change), since closing/reopening the popup
// already resumes tracking rather than losing the generation.
const MAX_POLL_MS = 3 * 60 * 1000;

// vendor/model-viewer.min.js (loaded before this file in popup.html) defaults
// to fetching its Draco decoder from Google's CDN at runtime — exactly the
// "remotely-hosted code" Chrome Web Store review disallows for an extension.
// Pointing it at the copy vendored alongside it instead (extension/vendor/
// draco/) must happen before any <model-viewer> element is created — set
// here, at module load, rather than inside the "done" view itself.
if (window.ModelViewerElement) {
  window.ModelViewerElement.dracoDecoderLocation = chrome.runtime.getURL("vendor/draco/");
}

const app = document.getElementById("app");
let state = { view: "loading" };
// Set once in boot() (best-effort — stays null on any fetch failure, which
// just means the views below render without the "Холбогдсон: ..." line/
// credits badge rather than blocking anything). See app/api/extension/me/route.ts.
let connectedEmail = null;
let connectedCredits = null;

// Static markup (popup.html) — stays visible across every view, so it's
// wired once here rather than rebuilt by the VIEWS render functions below.
const navCreditsButton = document.getElementById("nav-credits");
const navModelsButton = document.getElementById("nav-models");
navCreditsButton.addEventListener("click", () => void openBuyView());
navModelsButton.addEventListener("click", () => void openModelsList());

function renderBrandBar() {
  // Nothing useful to show/do before a token even exists, or while the very
  // first boot() fetch (which populates connectedCredits) hasn't landed yet.
  const show = state.view !== "need-token" && state.view !== "loading";
  navCreditsButton.hidden = !show;
  navModelsButton.hidden = !show;
  if (show) {
    navCreditsButton.textContent = connectedCredits != null ? `${connectedCredits} кр.` : "…";
  }
}

function render() {
  renderBrandBar();
  app.innerHTML = "";
  const view = VIEWS[state.view];
  if (view) app.appendChild(view());
}

function el(tag, props, children) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  (children || []).forEach((c) => node.appendChild(c));
  return node;
}

// Same path data as the lucide-react icons the rest of the product (the
// Next.js app) uses for these exact states — this extension has no build
// step to pull the npm package in, so the path data is copied directly
// rather than the icon reading visually inconsistent from the web app.
const ICON_PATHS = {
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
  warning:
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};
function icon(name, cls) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("class", `icon ${cls || ""}`.trim());
  svg.innerHTML = ICON_PATHS[name];
  return svg;
}

// ---------------------------------------------------------------- storage

async function getToken() {
  const { realifyToken } = await chrome.storage.local.get("realifyToken");
  return realifyToken || null;
}
async function setToken(token) {
  await chrome.storage.local.set({ realifyToken: token });
}
async function clearToken() {
  await chrome.storage.local.remove("realifyToken");
}
async function getPendingImage() {
  const { realifyPendingImage } = await chrome.storage.session.get("realifyPendingImage");
  return realifyPendingImage || null;
}
async function clearPendingImage() {
  await chrome.storage.session.remove("realifyPendingImage");
  chrome.action.setBadgeText({ text: "" });
}
// Only clears storage if it still holds the image this call thinks it's
// clearing — a right-click on a new image elsewhere can overwrite
// realifyPendingImage while a previous submission is still in flight, and
// that unrelated new selection must survive this call.
async function clearPendingImageIfMatches(srcUrl) {
  const current = await getPendingImage();
  if (current && current.srcUrl === srcUrl) {
    await clearPendingImage();
  }
}

// The popup is a normal browser popup: clicking anywhere outside it closes
// it immediately, which used to also kill the in-memory polling loop in
// pollUntilReady() below — the generation itself kept running server-side
// (it's already a submitted, async job by that point), but the popup lost
// all track of it, and reopening showed the stale "ready-to-generate"
// thumbnail again, risking a second paid generation of the same image.
// Persisting which modelId is in flight lets boot() resume polling instead
// of restarting from scratch.
async function getActiveGeneration() {
  const { realifyActiveGeneration } = await chrome.storage.session.get("realifyActiveGeneration");
  return realifyActiveGeneration || null;
}
async function setActiveGeneration(modelId) {
  await chrome.storage.session.set({ realifyActiveGeneration: { modelId, startedAt: Date.now() } });
}
async function clearActiveGeneration() {
  await chrome.storage.session.remove("realifyActiveGeneration");
}

// ------------------------------------------------------------------- api

async function api(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${REALIFY_API_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    await clearToken();
    state = { view: "need-token", message: "Токен хүчингүй байна. Дахин холбоно уу." };
    render();
    throw new Error("unauthorized");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Алдаа гарлаа (${res.status})`);
  return body;
}

// ---------------------------------------------------------------- views

const VIEWS = {
  loading() {
    return el("p", { text: "Ачаалж байна…" });
  },

  "need-token"() {
    const input = el("input", { type: "password", placeholder: "rf_live_..." });
    const err = state.message ? el("p", { class: "error", text: state.message }) : null;
    const wrap = el("div", { class: "card" }, [
      el("p", { text: "Realify акаунтаа холбохын тулд токеноо paste хийнэ үү. Токенийг Realify > Тохиргоо хуудаснаас үүсгэнэ." }),
      input,
      el("button", {
        onclick: async () => {
          const value = input.value.trim();
          if (!value) return;
          await setToken(value);
          state = { view: "boot" };
          render();
          boot();
        },
        text: "Холбох",
      }),
    ]);
    return err ? el("div", {}, [err, wrap]) : wrap;
  },

  "no-image"() {
    const items = [
      icon("image"),
      el("p", { text: "Ямар нэг сайт дээрх бүтээгдэхүүний зурган дээр хулганы баруун товч дараад “Realify — 3D болгох” сонго." }),
    ];
    if (connectedEmail) {
      items.push(el("p", { style: "font-size: 11px;", text: `Холбогдсон: ${connectedEmail}` }));
    }
    items.push(el("button", { class: "link", onclick: forgetToken, text: "Токен солих" }));
    return el("div", { class: "card" }, items);
  },

  "ready-to-generate"() {
    const img = el("img", { class: "thumb", src: state.image.srcUrl, alt: "" });
    const frame = el("div", { class: "thumb-frame" }, [img]);
    img.addEventListener("error", () => {
      frame.replaceWith(el("p", { class: "error", text: "Энэ зургийг урьдчилан харах боломжгүй байна — генерац хийхэд саад болохгүй." }));
    });

    const children = [frame];

    // Multi-view picker — see background.js's realifyScanForGalleryImages.
    // Optional: 0 selected just runs the existing single-photo path.
    const candidates = state.image.candidates || [];
    const selected = state.image.selected || [];
    if (candidates.length > 0) {
      const grid = el("div", { class: "angle-grid" });
      candidates.forEach((c) => {
        const order = selected.indexOf(c.src);
        const thumb = el("img", { class: "angle-thumb", src: c.src, alt: c.alt || "" });
        thumb.addEventListener("error", () => tile.remove());
        const badge = order >= 0 ? el("span", { class: "angle-badge", text: String(order + 1) }) : null;
        const tile = el(
          "button",
          {
            type: "button",
            class: `angle-tile${order >= 0 ? " selected" : ""}`,
            onclick: () => {
              const current = state.image.selected || [];
              const idx = current.indexOf(c.src);
              let next;
              if (idx >= 0) {
                next = current.filter((s) => s !== c.src);
              } else if (current.length >= 3) {
                return; // Tripo's files array is capped at [front, left, back, right] — 3 extra max.
              } else {
                next = [...current, c.src];
              }
              state.image = { ...state.image, selected: next };
              render();
            },
          },
          badge ? [thumb, badge] : [thumb],
        );
        grid.appendChild(tile);
      });
      children.push(
        el("p", { style: "font-size: 11px;", text: "Нэмэлт өнцөг сонгох (заавал биш) — сонгосон дараалал зүүн/ард/баруун тал болно:" }),
        grid,
      );
    }

    children.push(
      el("button", { onclick: () => void startGeneration(), text: "3D болгох" }),
      // CLAUDE.md rule 20's upload-quality guidance (single clear subject,
      // no heavy shadow/blur) only ever lived in the main app's upload
      // screen before this — right-clicking an arbitrary web photo skips
      // that screen entirely, so this is the one place left to say it,
      // even though there's no way here to preview/crop before spending
      // the credit the way the app's own capture flow allows.
      el("p", { style: "font-size: 11.5px;", text: "Хамгийн сайн үр дүнд: тод, ганц объект дүрсэлсэн, бүдэг биш зураг сонго." }),
      el("p", { style: "font-size: 11.5px;", text: "1 кредит зарцуулна" }),
    );
    if (connectedEmail) {
      children.push(el("p", { style: "font-size: 11px;", text: `Холбогдсон: ${connectedEmail}` }));
    }
    children.push(el("button", { class: "link", onclick: forgetToken, text: "Токен солих" }));

    return el("div", { class: "card" }, children);
  },

  working() {
    const spinner = el("span", { class: "spinner lg" });
    // Indeterminate — pollUntilReady's own elapsed-time message already
    // tells the user something real, this bar's only job is showing "still
    // moving" between polls (see .progress-bar/-fill in popup.css). Not
    // shown at all once real progress can't be inferred, but there's no
    // total duration to compute a determinate fill from either way.
    const progressBar = el("div", { class: "progress-bar" }, [el("div", { class: "progress-bar-fill" })]);
    const items = [];
    // Keeps the source photo visible (dimmed, spinner on top) instead of an
    // empty card while working — matches the mobile app's own
    // GeneratingStep, which shows the same source photo under its progress
    // ring rather than a blank screen.
    if (state.image?.srcUrl) {
      const img = el("img", { class: "thumb", src: state.image.srcUrl, alt: "" });
      items.push(el("div", { class: "thumb-frame working" }, [img, el("div", { class: "overlay" }, [spinner])]));
      items.push(el("p", { text: state.message || "Боловсруулж байна…" }));
      items.push(progressBar);
    } else {
      items.push(el("div", { class: "progress" }, [spinner, el("span", { text: state.message || "Боловсруулж байна…" })]));
      items.push(progressBar);
    }
    return el("div", { class: "card" }, items);
  },

  done() {
    const items = [
      icon("check", "success"),
      el("p", { class: "heading", text: "Бэлэн боллоо!" }),
    ];

    // Interactive preview right in the popup (drag to orbit, scroll/pinch to
    // zoom — model-viewer's own default camera-controls behavior, no extra
    // wiring needed) — see vendor/model-viewer.min.js's header comment in
    // popup.html for why this is a vendored file, not a CDN <script src>.
    // glbUrl from app/api/extension/models/[id]/route.ts may be root-relative
    // (lib/models.ts's buildModelUrl falls back to "/api/models/..." until
    // NEXT_PUBLIC_MODELS_CDN_URL is set) — resolving it against
    // REALIFY_API_BASE, not the popup's own chrome-extension:// origin, is
    // what makes it fetchable at all.
    if (state.result.glbUrl) {
      const viewer = document.createElement("model-viewer");
      viewer.className = "model-preview";
      viewer.setAttribute("src", new URL(state.result.glbUrl, REALIFY_API_BASE).href);
      viewer.setAttribute("alt", "3D загвар");
      viewer.setAttribute("camera-controls", "");
      viewer.setAttribute("shadow-intensity", "1");
      viewer.addEventListener("error", () => {
        viewer.replaceWith(el("p", { class: "error", text: "3D урьдчилан харах ачаалагдсангүй — QR код ажиллах хэвээр." }));
      });
      items.push(viewer);
    }

    items.push(
      el("img", { class: "qr", src: state.result.qrDataUrl, alt: "QR код" }),
      el("p", { class: "share-url", text: state.result.shareUrl }),
      el("button", {
        onclick: async (e) => {
          await navigator.clipboard.writeText(state.result.shareUrl);
          e.target.textContent = "Хуулагдлаа";
          setTimeout(() => (e.target.textContent = "Холбоос хуулах"), 1500);
        },
        text: "Холбоос хуулах",
      }),
      el("p", { text: "Утсандаа нээгээд AR-аар шууд өрөөндөө байрлуулж үзээрэй." }),
      // "Миний загварууд"-с нээсэн үед энэ бол өнөөдрийн шинэ generation биш
      // өнгөрсөн загвар харж байгаа тул "Дуусгах" (шинэ зурган рүү шилжих)
      // биш "Буцах" (жагсаалт руу буцах) утга учиртай.
      state.fromHistory
        ? el("button", { class: "secondary", onclick: () => void openModelsList(), text: "Буцах" })
        : el("button", { class: "secondary", onclick: () => void resetToIdle(), text: "Дуусгах" }),
    );
    return el("div", { class: "card" }, items);
  },

  error() {
    return el("div", { class: "card" }, [
      icon("warning", "danger"),
      el("p", { class: "error", text: state.message || "Алдаа гарлаа." }),
      el("button", { onclick: () => void resetToIdle(), text: "Дахин оролдох" }),
    ]);
  },

  models() {
    const items = [el("button", { class: "link", onclick: () => void boot(), text: "← Буцах" })];
    if (state.models.length === 0) {
      items.push(el("p", { text: "Одоогоор загвар алга." }));
    } else {
      const STATUS_LABELS = { pending: "Хүлээгдэж байна", processing: "Боловсруулж байна", ready: "Бэлэн", failed: "Амжилтгүй" };
      const list = el("div", { class: "model-list" });
      state.models.forEach((m) => {
        const thumb = m.renderUrl
          ? el("img", { class: "model-list-thumb", src: new URL(m.renderUrl, REALIFY_API_BASE).href, alt: "" })
          : el("div", { class: "model-list-thumb placeholder" });
        // Only a finished model has anything to show — matches this same
        // gate on app/api/extension/models/[id]/route.ts's own qrDataUrl
        // (only generated once status === "ready"). Built conditionally, not
        // `disabled: undefined` — el()'s setAttribute would stringify that
        // to the literal text "undefined", which is still a truthy HTML
        // boolean attribute (disables every row regardless of status).
        const rowProps = { type: "button", class: "model-list-row", onclick: () => void openModelFromHistory(m.id) };
        if (m.status !== "ready") rowProps.disabled = "";
        const row = el("button", rowProps, [
          thumb,
          el("span", { class: "model-list-status", text: STATUS_LABELS[m.status] || m.status }),
        ]);
        list.appendChild(row);
      });
      items.push(list);
    }
    return el("div", { class: "card" }, items);
  },

  buy() {
    const items = [el("button", { class: "link", onclick: () => void boot(), text: "← Буцах" })];
    state.packs.forEach((pack) => {
      items.push(
        el("button", {
          onclick: () => void buyPack(pack.id),
          text: `${pack.credits} кредит — ${pack.amountMnt.toLocaleString("mn-MN")}₮`,
        }),
      );
    });
    return el("div", { class: "card" }, items);
  },

  "checkout-started"() {
    return el("div", { class: "card" }, [
      icon("check", "success"),
      el("p", {
        text: "Төлбөрийн цонх шинэ tab дээр нээгдлээ. Төлбөрөө хийгээд буцаж ирээд popup-оо дахин нээгээрэй — кредит шинэчлэгдсэн байх болно.",
      }),
      el("button", { class: "secondary", onclick: () => void boot(), text: "Ойлголоо" }),
    ]);
  },
};

async function forgetToken() {
  await clearToken();
  state = { view: "need-token" };
  render();
}

async function resetToIdle() {
  // Also clears any tracked in-flight generation — without this, the error
  // view's "Дахин оролдох" re-entered boot(), which resumed polling the
  // same permanently-broken modelId forever with no way back to picking a
  // new image (see pollUntilReady's non-"failed" error path).
  await clearActiveGeneration();
  await clearPendingImage();
  // pollUntilReady persists a finished result/error here (chrome.storage.
  // session) so a popup close right after "done"/"error" can still recover
  // it — but that means it's still sitting there if the user instead clicks
  // "Дуусгах"/"Дахин оролдох" WITHOUT closing the popup first. Without this,
  // boot() below would immediately find that same realifyLastResult again
  // and show the just-dismissed result a second time instead of moving on.
  await chrome.storage.session.remove(["realifyLastResult", "realifyLastError"]);
  state = { view: "boot" };
  render();
  boot();
}

// --------------------------------------------------------- models & credits

async function openModelsList() {
  state = { view: "loading" };
  render();
  try {
    const body = await api("/api/extension/models");
    state = { view: "models", models: body.models || [] };
  } catch (err) {
    if (err.message === "unauthorized") return; // already rendered need-token
    state = { view: "error", message: err.message || "Загваруудыг ачаалахад алдаа гарлаа." };
  }
  render();
}

async function openModelFromHistory(id) {
  state = { view: "loading" };
  render();
  try {
    const body = await api(`/api/extension/models/${id}`);
    state = { view: "done", result: body, fromHistory: true };
  } catch (err) {
    if (err.message === "unauthorized") return;
    state = { view: "error", message: err.message || "Загварыг ачаалахад алдаа гарлаа." };
  }
  render();
}

async function openBuyView() {
  state = { view: "loading" };
  render();
  try {
    // Public/unauthenticated (app/api/extension/credit-packs/route.ts — no
    // user-specific data, just current pricing) — plain fetch, not api(),
    // which would attach a Bearer token this endpoint doesn't check and
    // apply 401 handling that doesn't apply here either.
    const res = await fetch(`${REALIFY_API_BASE}/api/extension/credit-packs`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Багцуудыг ачаалахад алдаа гарлаа (${res.status})`);
    state = { view: "buy", packs: body.packs || [] };
  } catch (err) {
    state = { view: "error", message: err.message || "Багцуудыг ачаалахад алдаа гарлаа." };
  }
  render();
}

async function buyPack(packId) {
  state = { view: "loading" };
  render();
  try {
    const body = await api("/api/extension/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId, idempotencyKey: crypto.randomUUID() }),
    });
    // Not a popup navigation — pay.wire.mn is a different origin, and a
    // Chrome action popup closes the instant it loses focus (see
    // background.js's own header comment on this), which would kill a
    // hosted-checkout page mid-flow. A real tab survives that.
    chrome.tabs.create({ url: body.url });
    state = { view: "checkout-started" };
  } catch (err) {
    if (err.message === "unauthorized") return;
    state = { view: "error", message: err.message || "Төлбөр эхлүүлэхэд алдаа гарлаа." };
  }
  render();
}

// ------------------------------------------------------------- generate

function readImageDimensions(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

// Best-effort upload of one additional angle (from the gallery picker) —
// unlike the required front image below, a failure here must never abort
// the whole generation. Returns the uploaded key, or null if anything about
// this particular image didn't work out (download, format, size, upload).
async function downloadAndUploadImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const contentType = RealifyLib.guessContentType(blob.type, url);
    if (!contentType) return null;
    if (blob.size > RealifyLib.MAX_UPLOAD_BYTES) return null;

    const presign = await api("/api/extension/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType, contentLength: blob.size }),
    });
    const putRes = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
    if (!putRes.ok) return null;
    return presign.key;
  } catch (err) {
    console.warn("Realify: extra angle upload failed, continuing without it", err);
    return null;
  }
}

async function startGeneration() {
  const srcUrl = state.image.srcUrl;
  // Order chosen by the user in the picker (extension/popup.js's angle-grid
  // click handler) — position 0/1/2 map to left/back/right, matching
  // lib/tripo.ts's multiview [front, left, back, right] slot order.
  const selectedAngles = state.image.selected || [];
  const image = { srcUrl };

  // Cheap, URL-only check before spending a network round trip: Chrome's
  // contextMenus API can't filter which images get the menu item by
  // format, so this is the earliest point a clearly-unsupported image
  // (favicon, SVG/GIF icon, ...) can be caught.
  if (RealifyLib.hasKnownUnsupportedExtension(srcUrl)) {
    state = { view: "error", message: "Энэ зургийн формат дэмжигдэхгүй (JPEG/PNG/WEBP л дэмжигдэнэ). Бүтээгдэхүүний жинхэнэ зурган дээр right-click хийнэ үү." };
    render();
    return;
  }

  state = { view: "working", message: "Зургийг татаж байна…", image };
  render();

  try {
    // host_permissions in manifest.json covers http(s)://*/* specifically
    // so this fetch bypasses page CORS regardless of the image host's own
    // headers — without that grant, a cross-origin fetch() rejects with a
    // bare "Failed to fetch" (no useful detail), which is why the catch
    // below rewrites that specific case into an actionable message rather
    // than surfacing the raw browser error.
    let imgRes;
    try {
      imgRes = await fetch(srcUrl);
    } catch {
      throw new Error("Энэ зургийг татаж чадсангүй (сүлжээ/CORS). Extension шинэчлэгдсэн эсэхийг chrome://extensions дээрээс шалгаад дахин оролдоно уу.");
    }
    if (!imgRes.ok) throw new Error("Энэ зургийг татаж чадсангүй. Өөр зураг дээр оролдоно уу.");
    const blob = await imgRes.blob();

    const contentType = RealifyLib.guessContentType(blob.type, srcUrl);
    if (!contentType) throw new Error("Дэмжигдэхгүй зургийн формат (JPEG/PNG/WEBP л дэмжигдэнэ).");

    // Checked here, right after download, rather than letting
    // /api/extension/upload-url's own MAX_UPLOAD_BYTES check catch it —
    // that would mean the full (possibly large) download already
    // happened for nothing before the user sees any error.
    if (blob.size > RealifyLib.MAX_UPLOAD_BYTES) {
      throw new Error(`Зураг хэт том байна (${(blob.size / 1024 / 1024).toFixed(1)}MB, ${RealifyLib.MAX_UPLOAD_BYTES / 1024 / 1024}MB хүртэл). Өөр зураг дээр оролдоно уу.`);
    }

    const { width, height } = await readImageDimensions(blob);

    state = { view: "working", message: "Хуулж байна…", image };
    render();
    const presign = await api("/api/extension/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType, contentLength: blob.size }),
    });

    const putRes = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
    if (!putRes.ok) throw new Error("Хуулахад алдаа гарлаа.");

    let angleKeys = [];
    if (selectedAngles.length > 0) {
      state = { view: "working", message: "Нэмэлт өнцгүүдийг хуулж байна…", image };
      render();
      // Sequential, not Promise.all: each one is a presign + PUT pair against
      // the same per-user upload-url endpoint — no need to race them for a
      // handful of extra images, and it keeps the "Хуулж байна" message
      // meaningful rather than firing 3 requests at once with no ordering.
      for (const url of selectedAngles) {
        angleKeys.push(await downloadAndUploadImage(url));
      }
    }
    const [leftKey, backKey, rightKey] = angleKeys;

    // pollUntilReady's own tick() takes over with a real elapsed-time
    // message the moment actual polling starts, right below — this is only
    // shown for the brief request itself.
    state = { view: "working", message: "Эхлүүлж байна…", image };
    render();
    const gen = await api("/api/extension/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceImageKey: presign.key,
        idempotencyKey: crypto.randomUUID(),
        sourceImageWidth: width,
        sourceImageHeight: height,
        sourceImageKeyLeft: leftKey || undefined,
        sourceImageKeyBack: backKey || undefined,
        sourceImageKeyRight: rightKey || undefined,
      }),
    });

    // The job is now submitted and running server-side regardless of what
    // this popup does next — record it BEFORE polling starts so closing the
    // popup mid-poll (which happens the instant the user clicks anywhere
    // outside it) leaves something for boot() to resume, not a dead end.
    // Also drop the pending-image association: re-clicking "3D болгох" from
    // a stale "ready-to-generate" screen would otherwise submit the same
    // photo a second time and spend a second credit.
    await setActiveGeneration(gen.modelId);
    // Hands off to background.js's own independent poll (chrome.alarms —
    // survives this popup closing, which local polling below can't) so the
    // result still surfaces as a badge + OS notification even if the user
    // never reopens the popup themselves.
    chrome.runtime.sendMessage({ type: "realify-track-start" }).catch(() => {});
    await clearPendingImageIfMatches(srcUrl);

    await pollUntilReady(gen.modelId, image);
  } catch (err) {
    if (err.message === "unauthorized") return; // already rendered need-token
    state = { view: "error", message: err.message || "Алдаа гарлаа." };
    render();
  }
}

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const clock = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}с`;
  return `3D болгож байна… ${clock}`;
}

// trueStartedAt: when the underlying generation actually started (from
// realifyActiveGeneration.startedAt — persisted by setActiveGeneration at
// submission time), NOT necessarily when THIS call to pollUntilReady began.
// Reopening the popup calls this again from boot()'s resume path, and the
// elapsed clock shown should read total real time, not reset to 0:00 just
// because the popup was closed for a while — the generation itself never
// stopped running server-side.
async function pollUntilReady(modelId, image, trueStartedAt = Date.now()) {
  // A per-second visible clock, independent of POLL_INTERVAL_MS's slower
  // status-check cadence — this is what replaces the old hardcoded
  // "(30–100 секунд)" text, which was never accurate (rule: real pipeline
  // is a two-stage GLB+USDZ generation, commonly 3-5 minutes, sometimes
  // more with a QA regen retry — see app/api/webhooks/tripo/route.ts).
  const tick = () => {
    state = { view: "working", message: formatElapsed(Math.floor((Date.now() - trueStartedAt) / 1000)), image };
    render();
  };
  tick();
  const tickTimer = setInterval(tick, 1000);

  try {
    const localStartedAt = Date.now();
    while (Date.now() - localStartedAt < MAX_POLL_MS) {
      const body = await api(`/api/extension/models/${modelId}`);
      if (body.status === "ready") {
        await clearActiveGeneration();
        // Tell background.js's own independent poll to stop (its job here is
        // done) WITHOUT clearing realifyLastResult/realifyLastError yet — the
        // popup itself just resolved this, so it writes its own copy of the
        // result right below. Without this, closing the popup in the instant
        // right after seeing "done" left nothing anywhere for boot() to
        // recover: realifyActiveGeneration/realifyPendingImage were already
        // cleared earlier, and the old stopBackgroundTracking() call here
        // wiped realifyLastResult too, before anything had a chance to set
        // it — reopening fell all the way through to "no-image" instead of
        // showing the result again. boot()'s existing realifyLastResult
        // check (below) is what now recovers this, the same way it already
        // recovers a result background.js discovered first.
        chrome.runtime.sendMessage({ type: "realify-track-stop" }).catch(() => {});
        await chrome.storage.session.set({ realifyLastResult: body });
        state = { view: "done", result: body };
        render();
        return;
      }
      if (body.status === "failed") {
        await clearActiveGeneration();
        chrome.runtime.sendMessage({ type: "realify-track-stop" }).catch(() => {});
        await chrome.storage.session.set({ realifyLastError: "Үүсгэлт амжилтгүй боллоо. Кредит буцаагдсан." });
        throw new Error("Үүсгэлт амжилтгүй боллоо. Кредит буцаагдсан.");
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    // Deliberately NOT clearing realifyActiveGeneration here — the job is
    // almost certainly still just running long, not stuck, so reopening the
    // popup should keep checking on it rather than losing track again.
    throw new Error("Удаж байна — popup-аа хааж дахин нээгээд шалгаарай (загвар боловсруулагдсаар л байна).");
  } finally {
    clearInterval(tickTimer);
  }
}

// -------------------------------------------------------------------- boot

async function boot() {
  const token = await getToken();
  if (!token) {
    state = { view: "need-token" };
    render();
    return;
  }

  // Best-effort, never blocks boot on anything BUT an actually-invalid token
  // — a network blip here just means the "Холбогдсон: ..." line doesn't
  // show, not a broken popup. An invalid/revoked token is different: api()
  // itself already cleared it and rendered "need-token" before throwing, so
  // this must return immediately rather than let the code below overwrite
  // that render with a stale no-image/ready-to-generate view built from
  // local storage that no longer matches a valid session.
  try {
    const body = await api("/api/extension/me");
    connectedEmail = body.email || null;
    connectedCredits = typeof body.credits === "number" ? body.credits : null;
  } catch (err) {
    if (err.message === "unauthorized") return;
    connectedEmail = null;
  }

  // background.js may have already resolved a generation (ready or failed)
  // while this popup was closed — checked first, ahead of active/pending,
  // since realifyActiveGeneration is already cleared by the time
  // background.js stores either of these (see its own checkActiveGeneration).
  // Without this check reopening the popup after a background-caught
  // completion would fall through to "no-image" and silently lose the
  // result the badge/notification just announced.
  //
  // Deliberately NOT removed from storage just for being read here (unlike
  // the old behavior) — a "done"/"error" screen should survive ANY number of
  // popup close/reopen cycles, not just one. The only thing that clears
  // these now is resetToIdle() (the user explicitly pressing
  // "Дуусгах"/"Дахин оролдох"), which is also the only place that should:
  // reopening without dismissing must keep showing the same result.
  const { realifyLastResult, realifyLastError } = await chrome.storage.session.get([
    "realifyLastResult",
    "realifyLastError",
  ]);
  if (realifyLastResult) {
    chrome.action.setBadgeText({ text: "" });
    state = { view: "done", result: realifyLastResult };
    render();
    return;
  }
  if (realifyLastError) {
    chrome.action.setBadgeText({ text: "" });
    state = { view: "error", message: realifyLastError };
    render();
    return;
  }

  // A generation submitted from a previous, now-closed popup takes
  // priority over any newly-captured pending image — resume tracking it
  // rather than silently abandoning it (see setActiveGeneration's comment).
  const active = await getActiveGeneration();
  if (active) {
    try {
      // active.startedAt (set by setActiveGeneration at submission time) is
      // when the generation truly began — passed through so the elapsed
      // clock reads real total time instead of resetting to 0:00 just
      // because the popup was closed for a while.
      await pollUntilReady(active.modelId, undefined, active.startedAt);
    } catch (err) {
      state = { view: "error", message: err.message || "Алдаа гарлаа." };
      render();
    }
    return;
  }

  const image = await getPendingImage();
  if (!image) {
    state = { view: "no-image" };
    render();
    return;
  }
  state = { view: "ready-to-generate", image: { ...image, selected: [] } };
  render();
}

state = { view: "boot" };
boot();
