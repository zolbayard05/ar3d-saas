# Chrome Web Store submission notes

Not shipped with the extension itself — reference content for the
Developer Dashboard submission form. Fill in the bracketed placeholders
before submitting.

## Store listing

**Name**: Realify — 3D & AR

**Short description** (132 chars max):
> Ямар ч онлайн дэлгүүрийн бүтээгдэхүүний зурган дээр right-click хийгээд 3D загвар, гар утсандаа AR-аар үзэх боломж авах.

**Detailed description**:
> Realify Chrome extension нь онлайн худалдааны сайт дээрх бүтээгдэхүүний
> зурган дээр хулганы баруун товч дараад, тухайн зургаас AI ашиглан 3D
> загвар үүсгэдэг. Үүссэн загварыг гар утсандаа нээж, өөрийн орчинд AR
> (нэмэгдсэн бодит байдал)-аар байрлуулж, худалдан авахаасаа өмнө бодит
> хэмжээ, харагдах байдлыг нь урьдчилан харах боломжтой.
>
> Ашиглахын тулд Realify акаунт (realify3d.vercel.app) болон Тохиргоо
> хэсгээс үүсгэсэн токен шаардлагатай.

**Category**: Productivity (or Shopping)

**Privacy policy URL**: https://realify3d.vercel.app/privacy

## Single purpose statement

> This extension lets a signed-in Realify user generate a 3D/AR model from
> a product photo they explicitly right-click on any webpage, and view the
> resulting share link/QR code. It does not do anything else.

## Permission justifications

- **`contextMenus`** — adds the "Realify — 3D болгох" right-click menu item
  on images; this is the extension's only way to know which image the user
  selected.
- **`storage`** — stores the user's personal access token
  (`chrome.storage.local`, this device only, never synced) and the
  in-flight generation state (`chrome.storage.session`) needed to resume
  progress if the popup is closed and reopened.
- **`alarms`** — used by the background service worker to keep checking on
  a generation's status even after the popup closes and the service worker
  itself is suspended for inactivity (`setInterval` cannot survive that;
  `chrome.alarms` can). Polls once every 30 seconds, only while a
  generation this user started is in flight.
- **`notifications`** — shows a single native OS notification when a
  generation the user started finishes or fails, since that can happen
  while they're on a different tab or site.
- **Host permissions (`http://*/*`, `https://*/*`)** — needed to fetch the
  bytes of the specific product image the user right-clicked, from
  whatever site it's hosted on. Most e-commerce image hosts don't send
  permissive CORS headers, so a normal cross-origin `fetch()` from the
  extension is blocked without this. The extension only ever fetches the
  one image URL the user explicitly selected via the context menu — it
  does not read page content, inject scripts into pages, or run on any
  page automatically.

## Before submitting

- [ ] Fill in a real support contact in `app/privacy/page.tsx` (marked
      with a `TODO` comment) — required by the Store's privacy policy
      requirements.
- [ ] Promotional images: a 1280×800 or 640×400 screenshot, and (optional
      but recommended) a 440×280 small promo tile.
- [ ] Bump `"version"` in `extension/manifest.json` for each resubmission.
- [ ] Broad host permissions (`http(s)://*/*`) route new/updated
      submissions through Google's more thorough review queue — budget
      extra time (historically days, not hours) before a release date
      depends on it.
