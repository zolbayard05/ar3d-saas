@AGENTS.md

# Project rules

Numbered so they can be referenced from code comments (e.g. "see rule 30").

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
