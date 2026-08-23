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
