# Known issues

Tracked here so they aren't rediscovered from scratch later. Not urgent
enough to have blocked the phase that surfaced them — fix opportunistically
or when they start actually hurting.

## ~~`@sparticuz/chromium` binary missing on first real Vercel deploy~~ — resolved

**Found**: the first production generation after the thumbnail-render
feature shipped. The user reported a model stuck "generating" for 10+
minutes. Diagnosis (Tripo's own task API timestamps + full Vercel log
messages, not just status codes) showed Tripo itself had simply taken
longer than usual (6m9s vs. the typical 1-3 min) — nothing was actually
stuck. But it surfaced a real, separate bug along the way: the render
step failed on every attempt, immediately, with:

```
Error: The input directory "/var/task/node_modules/@sparticuz/chromium/bin"
does not exist. If you are using a bundler (esbuild, webpack, etc.), you
must externalize @sparticuz/chromium so it is not relocated.
```

**Cause**: `serverExternalPackages` (next.config.ts) stops the bundler from
rewriting the package's `require()` calls, but that's a different mechanism
from Vercel's *output file tracing* — the step that decides which
`node_modules` files physically ship inside a route's deployed function.
`@sparticuz/chromium` resolves its binary path itself at runtime rather than
via a static `require()`, so Next's automatic tracing never detected the
`bin/` directory needed to come along, and it was silently absent from the
deployed function.

**Resolved by**: `outputFileTracingIncludes` in next.config.ts, scoped to
`/api/webhooks/tripo` specifically, force-including
`./node_modules/@sparticuz/chromium/**/*`.

**Also prompted two structural fixes, independent of this specific bug**
(a masking fix that happened to hide this failure would have been worse
than no fix — this bug needed to be found and root-caused, not just
absorbed): the render now runs strictly after the row is already `ready`
(`app/api/webhooks/tripo/route.ts`'s `after()` callback), with its own hard
timeout around the *entire* call including Chromium launch — previously
only the internal "wait for model to load" step was bounded, so a hang
(this bug happened to fail fast, not hang, but the code didn't guarantee
that) could have delayed the ready transition. And `lib/sweepStaleGenerations.ts`
now recovers any model that DOES get truly stuck (dead mid-webhook, no
retry ever arriving) — see that file for the timeout ceiling and the
race-safety argument against a live webhook.

## ~~Hydration mismatch on `<html data-theme>`~~ — resolved

**Found**: Phase 4, while browser-testing `/models/[id]` (unrelated to that
work — surfaced incidentally in the console).

**Was**: `app/layout.tsx` had a no-FOUC inline script that set `data-theme`
on `<html>` client-side from `localStorage`/system preference before
hydration, correct in intent (avoids a flash of the wrong theme) but
diverging from the server-rendered HTML in a way React flagged as a
mismatch.

**Resolved by** the design port to a single dark theme (see CLAUDE.md):
with no theme to choose between anymore, `data-theme="dark"` is now a
static attribute on `<html>` in the server-rendered output itself — nothing
sets it client-side, so there's nothing for the client and server to
disagree about. `hooks/useTheme.ts` and `components/ThemeSwitcher.tsx` were
removed as dead weight along with the light theme; this was a side effect
of that change, not a targeted fix.

## `ARRenderer.onUpdateScene` null-reference spam in browsers without AR hardware

**Found**: first live end-to-end pipeline test (real photo → Tripo → R2 →
`/models/[id]`), browsing the result in desktop Chrome (no WebXR
`immersive-ar` support / no AR-capable hardware on this machine).

**Symptom**: console floods with, on every scene update (so continuously
while `auto-rotate` is active):

```
TypeError: Cannot read properties of null (reading 'add')
  at ARRenderer.onUpdateScene (@google/model-viewer internals)
  at AnnotationModelViewerElement.updated → lit's _$didUpdate/performUpdate/
    scheduleUpdate/__enqueueUpdate cycle
```

**Cause (not yet root-caused)**: inside `@google/model-viewer` 4.3.1's own
AR-readiness code (`ARRenderer.onUpdateScene`), not in `components/ARViewer.tsx`.
Something `ARRenderer` expects to exist — likely a DOM node it only creates
once AR is actually available — is null when the browser has no
`immersive-ar` support at all, and it calls `.add(...)` on it unconditionally
on every scene update rather than gating on AR availability first.

**Impact so far**: the model still renders and displays correctly despite the
flood (visually confirmed) — camera-controls/auto-rotate work. Doesn't appear
to touch the iOS path: per rule 9, iOS AR launches via native Quick Look
through a direct `ios-src` navigation, entirely outside this WebXR-focused
`ARRenderer` code path, so this shouldn't affect the actual iPhone AR test.
Not yet confirmed on a real device (Android/desktop-with-AR-hardware) whether
this also fires there once AR genuinely is available — only tested so far on
a desktop browser with no AR hardware.

**Next step if picked back up**: check for an open upstream issue against
`@google/model-viewer` for `ARRenderer.onUpdateScene` before patching
locally; a version bump may already fix it.

## `/api/models` proxy — a real cost/latency line item, not just "not optimal yet"

**Context**: no custom domain is bound to the `models` R2 bucket yet (rule 4
— see README's "R2 setup" section), so `lib/models.ts`'s `buildModelUrl`
falls back to `app/api/models/[...key]/route.ts`, which streams a model
straight from R2 through a Vercel Function. That route's own comment already
calls this a "dev/staging-only stand-in," which is correct — but on a public
URL, every AR view of every model becomes a Vercel Function invocation plus
an R2 read, for as long as this stays unbound. That's billed compute and
added latency on the product's single most important interaction (opening
AR), not a rounding error to clean up "eventually."

**Mitigated, not eliminated** (see the commit hardening this route): the
proxy now sets `s-maxage` so Vercel's CDN actually caches a given model
after its first fetch — previously it forwarded R2's stored `max-age`-only
header, which Vercel's CDN doesn't cache on at all, so *every* fetch of
*every* model was hitting the function fresh. Repeat views of the same
model are now cheap. First views, and the cost of running this as a
function at all instead of Cloudflare serving a public bucket directly from
its own edge, are not something a cache header fixes.

**Revisit when**: a production domain exists to bind to the `models`
bucket (README's DNS/custom-domain steps) — that's the actual fix, not
further tuning of the interim proxy.

## Photo pre-flight validation — deferred, not forgotten

**Context**: the GLB validation gate (`lib/glbCompress.ts`'s `validateGlb`,
see CLAUDE.md) rejects a bad generation *after* paying Tripo for it. The
case that prompted it — a "512x512" placeholder graphic reconstructed into
a degenerate mesh — came from a smoke-test upload, not a real user, but the
underlying gap is real: nothing currently checks a photo *before* it's sent
to Tripo, so a genuinely bad user upload (rule 20's blurry/shadowed/
multi-object cases) still costs a full credit + generation round-trip
before the gate catches it.

**Options considered, not built**:
- A cheap image-statistics check (blur variance, resolution) — only catches
  blur, one of rule 20's three named categories. Would not have caught the
  placeholder case (it's crisp, not blurry) and doesn't touch multi-object
  scenes at all.
- A perceptual-hash blocklist against known placeholder/stock images — would
  catch this exact case precisely, but solves a problem real users don't
  actually have (no one uploads a placehold.co-style image by accident);
  the failure that prompted this was our own smoke test, not user behavior.
  Narrow, and needs an ongoingly-maintained list.
- A vision-model call ("is this a usable single-object product photo?")
  before ever hitting Tripo — the only option that addresses what rule 20
  actually names (blur, heavy shadow, multi-object), since it's a general
  content check rather than a signature match for one failure shape. Real
  per-upload cost (latency + a small $ amount) and needs a fail-open
  fallback so an outage doesn't block uploads.

**Decision**: build the vision-model check, not the narrower two — but not
yet. Setting a rejection threshold today would mean guessing from zero real
uploads, the same trap `MAX_ASPECT_RATIO` was already in (see CLAUDE.md).

**Revisit when**: there's a real corpus of user-submitted photos (rule 21's
own "after 30 showcase models" checkpoint is a reasonable trigger to reuse)
to tune a rejection threshold against, instead of guessing.
