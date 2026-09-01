// No framework, no build step — matches how the rest of this extension is
// plain script files. One small state machine rendered into #app.

const ALLOWED_IMAGE_TYPES = { "image/jpeg": true, "image/png": true, "image/webp": true };
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 3 * 60 * 1000; // generation is documented as 30-100s; give real headroom before giving up

const app = document.getElementById("app");
let state = { view: "loading" };

function render() {
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

// See extension/background.js's own comment block — that service worker
// independently polls the same status endpoint via chrome.alarms so a
// closed popup doesn't mean losing track of a generation. Clearing its
// alarm and any result it already stashed here (chrome.storage.session's
// realifyLastResult/realifyLastError) is what stops a result the popup
// just showed live from *also* surfacing as a stale badge/notification
// moments later.
async function stopBackgroundTracking() {
  chrome.runtime.sendMessage({ type: "realify-track-stop" }).catch(() => {});
  await chrome.storage.session.remove(["realifyLastResult", "realifyLastError"]);
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
    return el("div", { class: "card" }, [
      icon("image"),
      el("p", { text: "Ямар нэг сайт дээрх бүтээгдэхүүний зурган дээр хулганы баруун товч дараад “Realify — 3D болгох” сонго." }),
      el("button", { class: "link", onclick: forgetToken, text: "Токен солих" }),
    ]);
  },

  "ready-to-generate"() {
    const img = el("img", { class: "thumb", src: state.image.srcUrl, alt: "" });
    const frame = el("div", { class: "thumb-frame" }, [img]);
    img.addEventListener("error", () => {
      frame.replaceWith(el("p", { class: "error", text: "Энэ зургийг урьдчилан харах боломжгүй байна — генерац хийхэд саад болохгүй." }));
    });
    return el("div", { class: "card" }, [
      frame,
      el("button", { onclick: () => void startGeneration(), text: "3D болгох" }),
      el("p", { style: "font-size: 11.5px;", text: "1 кредит зарцуулна" }),
      el("button", { class: "link", onclick: forgetToken, text: "Токен солих" }),
    ]);
  },

  working() {
    const spinner = el("span", { class: "spinner lg" });
    const items = [];
    // Keeps the source photo visible (dimmed, spinner on top) instead of an
    // empty card while working — matches the mobile app's own
    // GeneratingStep, which shows the same source photo under its progress
    // ring rather than a blank screen.
    if (state.image?.srcUrl) {
      const img = el("img", { class: "thumb", src: state.image.srcUrl, alt: "" });
      items.push(el("div", { class: "thumb-frame working" }, [img, el("div", { class: "overlay" }, [spinner])]));
      items.push(el("p", { text: state.message || "Боловсруулж байна…" }));
    } else {
      items.push(el("div", { class: "progress" }, [spinner, el("span", { text: state.message || "Боловсруулж байна…" })]));
    }
    return el("div", { class: "card" }, items);
  },

  done() {
    const items = [
      icon("check", "success"),
      el("p", { class: "heading", text: "Бэлэн боллоо!" }),
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
      el("button", { class: "secondary", onclick: () => void resetToIdle(), text: "Дуусгах" }),
    ];
    return el("div", { class: "card" }, items);
  },

  error() {
    return el("div", { class: "card" }, [
      icon("warning", "danger"),
      el("p", { class: "error", text: state.message || "Алдаа гарлаа." }),
      el("button", { onclick: () => void resetToIdle(), text: "Дахин оролдох" }),
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
  state = { view: "boot" };
  render();
  boot();
}

// ------------------------------------------------------------- generate

function guessContentType(blob, srcUrl) {
  if (ALLOWED_IMAGE_TYPES[blob.type]) return blob.type;
  const ext = (srcUrl.split("?")[0].split(".").pop() || "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

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

async function startGeneration() {
  const srcUrl = state.image.srcUrl;
  const image = { srcUrl };
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

    const contentType = guessContentType(blob, srcUrl);
    if (!contentType) throw new Error("Дэмжигдэхгүй зургийн формат (JPEG/PNG/WEBP л дэмжигдэнэ).");

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

    state = { view: "working", message: "3D болгож байна… (30–100 секунд)", image };
    render();
    const gen = await api("/api/extension/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceImageKey: presign.key,
        idempotencyKey: crypto.randomUUID(),
        sourceImageWidth: width,
        sourceImageHeight: height,
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

async function pollUntilReady(modelId, image) {
  state = { view: "working", message: "3D болгож байна… (30–100 секунд)", image };
  render();
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_POLL_MS) {
    const body = await api(`/api/extension/models/${modelId}`);
    if (body.status === "ready") {
      await clearActiveGeneration();
      // The popup itself just resolved this — stop background.js's own
      // independent poll (extension/background.js) and drop any result it
      // might already have raced to store, so reopening the popup later
      // doesn't replay a stale "done" notification/badge for a result
      // already shown here.
      await stopBackgroundTracking();
      state = { view: "done", result: body };
      render();
      return;
    }
    if (body.status === "failed") {
      await clearActiveGeneration();
      await stopBackgroundTracking();
      throw new Error("Үүсгэлт амжилтгүй боллоо. Кредит буцаагдсан.");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  // Deliberately NOT clearing realifyActiveGeneration here — the job is
  // almost certainly still just running long, not stuck, so reopening the
  // popup should keep checking on it rather than losing track again.
  throw new Error("Удаж байна — popup-аа хааж дахин нээгээд шалгаарай (загвар боловсруулагдсаар л байна).");
}

// -------------------------------------------------------------------- boot

async function boot() {
  const token = await getToken();
  if (!token) {
    state = { view: "need-token" };
    render();
    return;
  }

  // background.js may have already resolved a generation (ready or failed)
  // while this popup was closed — checked first, ahead of active/pending,
  // since realifyActiveGeneration is already cleared by the time
  // background.js stores either of these (see its own checkActiveGeneration).
  // Without this check reopening the popup after a background-caught
  // completion would fall through to "no-image" and silently lose the
  // result the badge/notification just announced.
  const { realifyLastResult, realifyLastError } = await chrome.storage.session.get([
    "realifyLastResult",
    "realifyLastError",
  ]);
  if (realifyLastResult) {
    await chrome.storage.session.remove("realifyLastResult");
    chrome.action.setBadgeText({ text: "" });
    state = { view: "done", result: realifyLastResult };
    render();
    return;
  }
  if (realifyLastError) {
    await chrome.storage.session.remove("realifyLastError");
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
      await pollUntilReady(active.modelId);
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
  state = { view: "ready-to-generate", image };
  render();
}

state = { view: "boot" };
boot();
