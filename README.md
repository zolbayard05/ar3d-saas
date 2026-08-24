# Realify

Upload a photo → generate a 3D model → view it in AR from a phone browser. PWA only, no
app stores. See the build spec in project history for full scope; phases land incrementally.

## Stack

Next.js 16 (App Router, TS strict) · Tailwind CSS v4 · Supabase (auth/DB/Realtime) ·
Cloudflare R2 · Tripo (image→3D) · `<model-viewer>` · Stripe · Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values — see comments in the file
npm run dev
```

Apply the database schema against your Supabase project (SQL editor, or `supabase db push`
if you have the CLI linked): run every file in `supabase/migrations/` in order.

## Project rules

See `CLAUDE.md` for durable rules AI assistants (and contributors) should follow — notably
that `proxy.ts` is a UX convenience, not an authorization boundary; every route handler and
Server Action must independently verify the session and resource ownership.

## Design system

All color/spacing/radius/shadow/font values live in `styles/tokens.css` (shape) and
`styles/themes.css` (per-theme colors, keyed off `data-theme` on `<html>`), mapped into
Tailwind via `@theme inline` in `app/globals.css`. Components use only the resulting semantic
classes (`bg-surface`, `text-muted`, `rounded-card`, ...) — never raw hex values or Tailwind's
default palette/arbitrary-value utilities. This is enforced by an ESLint rule in
`eslint.config.mjs` scoped to `components/**` and `app/**`.

To restyle the whole app, edit `styles/tokens.css` / `styles/themes.css` only.

## Storage: R2 buckets

Two buckets, provisioned by hand in the Cloudflare dashboard (R2 object storage —
there's no Terraform/CLI provisioning yet). See `CLAUDE.md` rules 1–6 for the
constraints behind these settings.

### `uploads` — private

- **Public Access**: disabled (default). Never enable a public URL or custom domain
  on this bucket — it holds raw user-uploaded source photos.
- **Access**: only via the S3 API (`https://<account-id>.r2.cloudflarestorage.com`),
  using a presigned PUT issued by `app/api/upload-url` (5 minute expiry). There is
  no presigned GET — nothing ever reads this bucket back to a browser.
- **Key convention**: `uploads/{userId}/{uuid}.{ext}` — always generated server-side
  from the authenticated session, never from client input (see rule 30 and the
  route's comments).
- **CORS** (Settings → CORS Policy) — allows the browser to PUT directly using the
  presigned URL:

  ```json
  [
    {
      "AllowedOrigins": ["https://<yourdomain>", "http://localhost:3000"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["content-type"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

### `models` — public, custom domain

- **Public Access**: enabled via **Custom Domain only** (see the DNS section
  below) — leave the `*.r2.dev` public development URL toggle off. Rule 4: never
  serve models from `r2.dev` in production, it's rate-limited.
- **Not yet configured** — no production domain exists yet, so there's no custom
  domain bound and `NEXT_PUBLIC_MODELS_CDN_URL` is unset. **This blocks Phase 4.**
  See the "R2 setup" section below for the steps once a domain exists; don't
  substitute the `*.r2.dev` URL to unblock Phase 4 early.
- **Access pattern**: plain public GET, no presigned URLs (rule 6 — a presigned GET
  would expire and break shared AR links / QR codes). Reads are safe to leave
  unauthenticated because keys are unguessable UUIDs (`models.id` is
  `gen_random_uuid()`), not because the bucket restricts who can read.
- **Key convention**: `models/{modelId}.glb` and `models/{modelId}.usdz`, written by
  the generation pipeline (Phase 3) under `service_role` — see `lib/r2.ts` for the
  required `Content-Type` (rule 2) and `Cache-Control` (rule 3) on every write.
- **CORS** (Settings → CORS Policy) — `<model-viewer>` fetches the GLB/USDZ from JS,
  so it needs CORS; native iOS Quick Look opens the USDZ via direct navigation and
  doesn't:

  ```json
  [
    {
      "AllowedOrigins": ["https://<yourdomain>", "http://localhost:3000"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 86400
    }
  ]
  ```

Replace `<yourdomain>` with the real production origin in both policies before
applying them — keep `http://localhost:3000` alongside it for local dev.

Once both buckets exist and `.env.local` has real `R2_*` values, run
`node scripts/verify-r2-storage.mjs` — it presigns and PUTs a real object, reads
back the actual stored `Content-Type`, confirms a presigned URL can't be redirected
to another key, confirms `uploads` rejects an unauthenticated direct fetch, and (once
`NEXT_PUBLIC_MODELS_CDN_URL` is live) checks the `models` CORS policy against a real
and a spoofed origin.

## Generation pipeline (Tripo)

`POST /api/generate` (rule 12) deducts a credit, inserts a `pending` models
row, and submits an image-to-model task to Tripo — then returns 202
immediately. `POST /api/webhooks/tripo` does everything else, driven entirely
by Tripo's callbacks:

1. Image-to-model task completes → webhook fires → handler downloads the
   result and re-uploads it to the `models` bucket as `{modelId}.glb`, then
   submits a **second**, separate Tripo task (`/models/convert` → `USDZ`) —
   Tripo's image-to-model task only produces GLB; rule 1 needs both formats.
2. That conversion task completes → webhook fires again → handler downloads,
   uploads `{modelId}.usdz`, and flips the row to `ready`.

Both events land on the same `/api/webhooks/tripo` endpoint; `models.provider_job_id`
/ `models.usdz_provider_job_id` is how an incoming `task_id` gets matched back
to which stage it belongs to.

**Required setup Tripo doesn't take as request parameters:**

- **Webhook URL and signing secret are configured in the Tripo developer
  console** (Settings → Webhooks), not passed per-request. Point it at
  `https://<your-deployment>/api/webhooks/tripo`, then copy the `whsec_...`
  secret it shows into `TRIPO_WEBHOOK_SECRET`. In local dev this means
  `localhost` isn't reachable from Tripo — use a tunnel (ngrok or similar) and
  update the console's webhook URL to match while testing.
- `TRIPO_API_KEY` — from the same console.
- `TRIPO_MODEL_VERSION` — optional, defaults to `v2.5-20250123` in code (see
  `lib/tripo.ts`) if unset.

`glb_url`/`usdz_url` on a `ready` model currently store the bare R2 **key**
(e.g. `models/<id>.glb`), not a full URL — `NEXT_PUBLIC_MODELS_CDN_URL` isn't
live yet (see the status note below), so there's nothing real to prefix onto
them yet. Phase 4 is responsible for joining `NEXT_PUBLIC_MODELS_CDN_URL` +
key at render time; nothing here needs to change once the domain exists.

Endpoint/field names and the webhook signature scheme in `lib/tripo.ts` are
sourced from Tripo's V3 OpenAPI spec as reconstructed by
[github.com/tryAGI/Tripo](https://github.com/tryAGI/Tripo) (a third-party SDK
— Tripo doesn't publish a public machine-readable schema) and cross-checked
against its webhook-signature source. Not independently verified against a
live Tripo account — confirm against a real task/webhook delivery before
relying on this in production.

## R2 setup (custom domain for model files)

> **Status: not started — no production domain yet.** `NEXT_PUBLIC_MODELS_CDN_URL` is
> unset, and the `models` bucket has no custom domain bound. **Phase 4 (AR viewer) is
> blocked on this** — it needs a live, non-`r2.dev` URL to put in `<model-viewer>`'s
> `src`/`ios-src`. Do not work around this by pointing at the bucket's `*.r2.dev`
> public development URL, even temporarily: rule 4 exists because `r2.dev` is
> rate-limited, and code that reads from it in dev tends to survive into production.
> Once a domain is registered, follow the steps below — DNS/SSL provisioning takes a
> few minutes, so do it before Phase 4 needs it live.

Constraint: generated `.glb`/`.usdz` files must never be served from the `*.r2.dev` domain in
production (it's rate-limited) — they're served from `NEXT_PUBLIC_MODELS_CDN_URL`
(e.g. `cdn.yourdomain.com`) instead. To connect it:

1. Your domain's DNS zone must be on Cloudflare (same account as the R2 bucket). If it isn't
   already, add it via Cloudflare's **partial (CNAME) setup** — this only needs the one
   subdomain you're using for the CDN, not a full nameserver migration of the whole domain.
2. Cloudflare dashboard → **R2 object storage** → the `models` bucket → **Settings** →
   **Custom Domains** → **Add**.
3. Enter the subdomain (e.g. `cdn.yourdomain.com`) → **Continue**. Cloudflare shows the exact
   DNS record it's about to create — **you do not create this record by hand**, it's
   auto-added to the zone since the zone is already on Cloudflare.
4. **Connect Domain**. Status shows "Initializing" then flips to "Active" within a few
   minutes (refresh the page to see it update).
5. Set `NEXT_PUBLIC_MODELS_CDN_URL=https://cdn.yourdomain.com` in `.env.local` / Vercel env vars.

Do this early — DNS/SSL provisioning has a few minutes of lag, and Phase 2's upload code
assumes the domain is already live.

(Source: [Cloudflare R2 public buckets docs](https://developers.cloudflare.com/r2/buckets/public-buckets/), verified 2026-08-18.)

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint .
```
