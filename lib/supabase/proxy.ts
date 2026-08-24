import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

// /dashboard dropped from this list — it's the public showcase feed now
// (showcase models to every visitor, plus the caller's own models when
// signed in; see app/(app)/dashboard/page.tsx). /library and /create are
// unaffected — added explicitly here since they'd previously only ever been
// gated by their own page-level redirect() + the (app) layout's blanket
// check, never by proxy itself (a real, if inert, gap: proxy is UX-only per
// rule 30, but "gated" should mean gated at every layer that claims to,
// this file included).
const PROTECTED_PREFIXES = ["/library", "/create", "/models"];
const AUTH_PAGES = ["/login"];

// Shared model links (QR codes, "send to a friend") must open for a
// signed-out visitor. Migration 0011's "models: public select ready" RLS
// policy is the actual data boundary — this only relaxes the UX redirect to
// match it. Scoped tight: GET only, and only the single-segment detail
// route (`/models/[id]`), so any deeper `/models/[id]/*` path stays gated.
// Mutations (title edit, scale persistence) are also blocked at
// the DB grant layer regardless of this — anon has no UPDATE grant on
// models (0009) — this exemption is belt-and-suspenders on top of that,
// not the real boundary (rule 30: proxy is UX only).
const PUBLIC_MODEL_DETAIL = /^\/models\/[^/]+\/?$/;

/**
 * Refreshes the Supabase session cookie on every request (Server Components
 * can't write cookies themselves) and enforces the protected/auth-only
 * route split. Called from the root proxy.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicModelDetail = request.method === "GET" && PUBLIC_MODEL_DETAIL.test(pathname);
  const isProtected =
    !isPublicModelDetail && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
