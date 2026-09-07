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
> **Хэрхэн холбож ашиглах вэ:**
> 1. realify3d.vercel.app дээр акаунт нээнэ (эсвэл нэвтэрнэ).
> 2. Зүүн цэснээс "Тохиргоо" → "Chrome өргөтгөл" хэсэгт орж, шинэ токен
>    үүсгэнэ.
> 3. Энэ токеныг хуулж аваад, extension-ийн попап дээр нэг удаа буулгаж
>    холбоно.
> 4. Дараа нь ямар ч сайтын бүтээгдэхүүний зурган дээр хулганы баруун
>    товч дараад "Realify — 3D болгох" гэснийг сонгоход л 3D загвар
>    үүсэж эхэлнэ.
>
> Ашиглах бүрт токен дахин холбох шаардлагагүй — extension нэг л удаа
> холбогдоод, дараагийн бүх зурган дээр шууд ажиллана.

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
- **`scripting`** — right after the user right-clicks a product image, a
  one-shot injected function (`background.js`'s `realifyScanForGalleryImages`)
  scans the same page for other images near the clicked one (a thumbnail
  gallery rail) so the user can optionally include other angles of the same
  product. Runs only immediately after that explicit right-click, reads only
  `<img>` `src`/`alt`/dimensions already visible in the page's own DOM, and
  never runs automatically or on a page the user hasn't interacted with.
- **Host permissions (`http://*/*`, `https://*/*`)** — needed to fetch the
  bytes of the specific product image the user right-clicked, from
  whatever site it's hosted on. Most e-commerce image hosts don't send
  permissive CORS headers, so a normal cross-origin `fetch()` from the
  extension is blocked without this. The extension only ever fetches the
  one image URL the user explicitly selected via the context menu — it
  does not read page content, inject scripts into pages, or run on any
  page automatically.

## Before submitting

- [x] Support contact in `app/privacy/page.tsx` — zolbayar.d05+realify@gmail.com.
- [x] Promotional screenshot: `store-assets/screenshot-1-generate-model.jpg`
      (1280×800) — the real "done" popup (real `popup.js`/`popup.css`
      markup, a real showcase model's own render, a real generated QR
      pointing at its share URL) on a branded backdrop. Optional 440×280
      small promo tile still not made — add one if the listing form asks.
- [ ] Bump `"version"` in `extension/manifest.json` for each resubmission
      (currently `0.1.0` — fine for the first submission).
- [ ] Broad host permissions (`http(s)://*/*`) route new/updated
      submissions through Google's more thorough review queue — budget
      extra time (historically days, not hours) before a release date
      depends on it.

## Submission steps (Developer Dashboard — needs your own Google account + the one-time $5 registration fee, so this part is on you)

1. https://chrome.google.com/webstore/devconsole → pay the $5 registration
   fee if you haven't already (one-time, per Google account).
2. "New item" → upload `extension/realify-extension.zip` (already built,
   matches the current source — see the file timestamps note below if you
   change any extension source file first).
3. Store listing tab: paste in the Name/description/category from this
   file. Upload `store-assets/screenshot-1-generate-model.jpg` as the
   screenshot. Privacy policy URL is already live at the link above.
4. Privacy practices tab: you'll have to justify each permission — the
   "Permission justifications" section above is written for exactly that
   form, copy it in per-permission.
5. Submit for review. Expect it to sit in Google's queue for days (broad
   host permissions trigger extra scrutiny) — this is normal, not a sign
   something's wrong.

If you change any file under `extension/` (other than this doc or
`store-assets/`) before submitting, rebuild the zip first:
`cd extension && zip -r realify-extension.zip . -x "store-assets/*" "STORE_LISTING.md" "*.zip" "lib.test.mjs"`
