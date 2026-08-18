# AR3D

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

## R2 setup (custom domain for model files)

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
