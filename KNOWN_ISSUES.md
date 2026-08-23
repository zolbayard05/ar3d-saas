# Known issues

Tracked here so they aren't rediscovered from scratch later. Not urgent
enough to have blocked the phase that surfaced them — fix opportunistically
or when they start actually hurting.

## Hydration mismatch on `<html data-theme>`

**Found**: Phase 4, while browser-testing `/models/[id]` (unrelated to that
work — surfaced incidentally in the console).

**Symptom**: React logs `A tree hydrated but some attributes of the server
rendered HTML didn't match the client properties`, pointing at
`data-theme="dark"` on `<html>`.

**Cause (diagnosed, not yet fixed)**: `app/layout.tsx` has a no-FOUC inline
script that runs before hydration and sets `data-theme` on `<html>`
synchronously from `localStorage`/system preference (see
`hooks/useTheme.ts`'s doc comment). That's deliberate — it's what prevents a
flash of the wrong theme on load. But it means the *real* DOM has already
diverged from the server-rendered HTML by the time React hydrates, and React
flags that divergence as a mismatch even though it's intentional and correct.

**Likely fix**: add `suppressHydrationWarning` to the `<html>` element in
`app/layout.tsx` — the standard fix for this exact pattern (same one
`next-themes` and similar libraries document). Scope it to `<html>` only, not
broader, so it doesn't mask a real mismatch elsewhere.

**Impact so far**: cosmetic console noise in dev; no observed effect on
correctness or the production build.

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
