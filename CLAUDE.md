@AGENTS.md

# Project rules

Numbered so they can be referenced from code comments (e.g. "see rule 30").

## Storage & AR constraints

1. **Every generated model MUST be stored in both `.glb` and `.usdz`.** GLB
   serves web + Android AR; USDZ serves Apple AR. Storing only one breaks
   half of all devices.
2. **On R2 upload, set `Content-Type` explicitly**: `.glb` →
   `model/gltf-binary`, `.usdz` → `model/vnd.usdz+zip`. R2 defaults to
   `application/octet-stream`, and with that MIME type iOS Quick Look fails
   SILENTLY — no error, nothing happens.
3. **Set `Cache-Control: public, max-age=31536000, immutable` on model
   objects.**
4. **Never serve models from the r2.dev domain in production** (rate-limited).
   Use a custom domain (`cdn.<domain>`) and document the DNS setup in the
   README.
5. **Two buckets**: `uploads` (private) and `models` (public, custom domain,
   CORS for GET/HEAD from our origin only).
5a. **An R2 API token's "Object Read & Write" permission only covers object
    operations** (GetObject/PutObject/ListObjects/HeadObject/HeadBucket). It
    does NOT cover bucket-level configuration — CORS, lifecycle rules, public
    access settings. Reading or writing those needs an "Admin Read & Write"
    token, or the Cloudflare dashboard directly. Don't burn a debugging cycle
    assuming a 403 on `GetBucketCorsCommand`/`PutBucketCorsCommand` means the
    policy wasn't applied — check the token's permission tier first.
6. **Never use presigned GET URLs for models** — they expire, which kills
   shared AR links and QR codes. Public bucket + unguessable UUID keys.
7. **Use `<model-viewer>` for AR launch.** Do NOT hand-roll the iOS `rel="ar"`
   anchor: Apple requires an `img` element as the direct first child of the
   anchor, and getting it wrong degrades to a plain file download instead of
   AR.
8. **Config**: `ar`, `ar-modes="webxr scene-viewer quick-look"`, `src` = GLB,
   `ios-src` = USDZ.
9. **Assume WebXR is unavailable on iPhone Safari.** iOS AR goes through
   native AR Quick Look: no custom UI, no in-AR analytics, and the user
   leaves our app during the session. Never build features that assume
   in-AR callbacks.
10. **Known iOS bug**: the AR button can grey out after a prior AR session
    until cache is cleared. Always provide a visible fallback so a user is
    never dead-ended.
11. **`<model-viewer>` must be a client component, dynamically imported** —
    it touches `window`/custom elements and will break SSR otherwise.

## Async pipeline

12. Generation takes 30–100 seconds. Never block a serverless function waiting
    for it. Flow: POST /api/generate → deduct credit → insert a `models` row as
    `pending` → submit the job to Tripo with a callback_url → return 202 plus
    the model id immediately.
13. The provider webhook handler must, in this order: verify the signature,
    download the provider's files and re-upload them to R2 (provider URLs
    expire), and only then update the DB row to `ready`. That order matters —
    if the row is marked ready first, clients fetch files that aren't there yet.
14. Client updates come from a Supabase Realtime subscription on the `models`
    row. No polling.
15. Uploads go browser → R2 directly via presigned PUT. Never route image bytes
    through a Next.js route handler; serverless body size limits will fail on
    real photos.

## Webhook and credit accounting

16. Webhooks retry. Every webhook handler must be idempotent — guard on a state
    transition, not on receipt. A second delivery for an already-processed model
    must be a no-op, never a second refund or a second write.
17. Credit deduction is atomic in a Postgres function (UPDATE ... WHERE
    credits > 0 RETURNING). A read-then-write pattern lets concurrent requests
    generate for free. This is a revenue bug, not a style issue.
18. A failed generation refunds the credit exactly once, via refund_credit,
    guarded on the transition into `failed`.
19. service_role is the only write path for status, glb_url, usdz_url, credits,
    and plan. Every write to those columns goes through a server action or
    webhook — never a client-side .update().

## Input quality

20. **Validate uploads client-side**: single clear subject, reasonable size,
    supported MIME. Show example good/bad reference images. Blurry photos,
    heavy shadows, and multi-object scenes produce unusable meshes and burn
    paid credits.
21. **Post-process for mobile AR**: target < 8 MB per model, Draco
    compression, textures capped at 1–2K. Large models simply never load on
    phones.
22. **AI meshes have no real-world scale.** Provide a scale control and
    persist the user's chosen scale per model.

## Auth & authorization

30. **`proxy.ts` is not an authorization boundary.** It refreshes the Supabase
    session cookie and redirects logged-out browsers away from `/dashboard`
    as a UX convenience only — it provides no security guarantee and can be
    bypassed. Every route handler and Server Action must independently call
    `supabase.auth.getUser()` and verify the caller owns the specific
    resource it's touching. Never assume proxy already checked this.
31. **Never use `supabase.auth.getSession()` for server-side authorization
    decisions.** `getSession()` reads the session from the cookie without
    revalidating it against the Auth server — a stale or forged cookie can
    pass. `getUser()` round-trips to Supabase and confirms the token is
    still valid; it's the only one safe to gate access with.
32. **Never edit a migration file that has already been applied to a live
    database.** Add a new migration file instead. An already-applied file is
    part of the historical record other environments replay in order —
    editing it in place means a fresh database and an existing one diverge
    silently, since the existing one already ran the old contents and won't
    re-run the edited version.
33. **RLS restricts rows, not columns.** A `USING (auth.uid() = id)` policy
    is satisfied by a user updating their own row, including columns that
    must be server-only (e.g. credits, plan, status) — row ownership says
    nothing about which columns they should be allowed to set. Any table
    with a mix of user-writable and server-only columns needs column-level
    `GRANT`/`REVOKE`, not just a row policy, to close that gap.
34. **`service_role` is the only write path for `profiles.credits`,
    `profiles.plan`, `models.status`, `models.glb_url`, and
    `models.usdz_url`.** `authenticated` has no grant on these columns at
    the database level (see rule 33) — every write to them must go through
    a server action or webhook using the service role key. Never add a
    client-side `.update()` touching these columns; it will fail at the
    database, and if it didn't, it would be the security hole rule 33
    exists to prevent.
35. **RLS restricts rows, not columns, and column-level grants must be
    audited for INSERT as well as UPDATE.** A user who can insert a row can
    set every column in it. We've hit this class of bug twice: first on
    UPDATE (rule 33 — a user updating their own row could also set
    server-only columns like credits/status), then on INSERT (`models`'s
    owner-insert policy only checked `user_id`, so a user could insert a row
    with `status = 'ready'` and a fabricated `glb_url`, self-granting a
    finished model for free). Any table with a mix of user-writable and
    server-only columns needs both directions checked, not just UPDATE.
