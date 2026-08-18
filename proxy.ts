import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed the `middleware` file convention to `proxy` — same
// mechanism, new name (see node_modules/next/dist/docs/.../proxy.md).
//
// SECURITY: this file provides NO security guarantee. It redirects an
// unauthenticated browser away from /dashboard as a UX convenience — it
// does not, and cannot, authorize access to any specific resource. Proxy
// can be bypassed (direct route-handler/Server Action calls, matcher
// misconfiguration, a moved route silently falling outside the matcher —
// see the "Good to know" note in the Next.js proxy execution-order docs),
// and Next.js's own guidance is to keep auth/authorization out of proxy
// and in the data access layer instead. See rule 30 in CLAUDE.md: every
// route handler and Server Action must independently call
// supabase.auth.getUser() (never getSession() for authorization — getUser()
// revalidates the token against the Auth server; getSession() trusts
// whatever is in the cookie) and check that the caller owns the specific
// row it's touching. Never assume "proxy already checked this."
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js).*)",
  ],
};
