import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";
import type { Database } from "@/lib/supabase/types";

// /dashboard dropped from this list — it's the public showcase feed now
// (showcase models to every visitor, plus the caller's own models when
// signed in; see app/(app)/dashboard/page.tsx). /library and /create are
// unaffected — added explicitly here since they'd previously only ever been
// gated by their own page-level redirect() + the (app) layout's blanket
// check, never by proxy itself (a real, if inert, gap: proxy is UX-only per
// rule 30, but "gated" should mean gated at every layer that claims to,
// this file included).
const PROTECTED_PREFIXES = ["/library", "/create", "/models", "/credits", "/settings"];
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

  // Desktop gate (2026-08-29) — runs before, and independent of, the
  // auth-redirect logic below: it applies to signed-in and signed-out
  // desktop visitors alike. AR only works on a phone, so the functional
  // app (dashboard/library/create/credits, and login — the only door into
  // those) has nothing for a desktop visitor to do; they get bounced to
  // "/", which app/page.tsx renders as a marketing landing (with a QR
  // into the real, unaffected mobile experience) for exactly this UA
  // check. /api/* is exempt — those are fetch/XHR/webhook targets
  // (Tripo, wire.mn), never a human page-view; gating them would break
  // payments and generation. /auth/* is exempt — password reset/confirm
  // links are opened from whatever device has the user's email open,
  // often a desktop mail client. Mobile requests never enter this block,
  // so every existing code path below (PROTECTED_PREFIXES,
  // PUBLIC_MODEL_DETAIL, the auth-page redirect) runs exactly as it did
  // before this — zero behavior change for phones.
  // Reproduced live: without this, a desktop UA's own <img>/Image() fetch
  // for /icon-192.png, /icon-512.png etc. (root-level public/ files proxy's
  // own matcher doesn't name-exclude — only _next/static, favicon.ico,
  // manifest.webmanifest, icons/, sw.js are) got redirected to "/" just
  // like a real page nav would, so the browser silently received the
  // landing page's HTML instead of PNG bytes for an <img src> — broke the
  // wordmark icon AND, less obviously, DesktopQrCard's logo-badge Image()
  // load (its onerror fired even though the request "succeeded": it
  // successfully fetched HTML, which isn't decodable as an image).
  // Sec-Fetch-Dest is a standard Fetch Metadata header modern browsers send
  // on every request; it's "document" only for an actual top-level page
  // navigation, and something else (image/script/style/font/...) for every
  // sub-resource fetch a page makes — checking it instead of naming every
  // possible static filename is what makes this fix general rather than
  // reactive to whichever file happened to break first. A request with no
  // header at all (curl, most non-browser tools) is NOT treated as a
  // sub-resource — it still goes through the normal page-navigation gate.
  const fetchDest = request.headers.get("sec-fetch-dest");
  const isSubResourceRequest = fetchDest !== null && fetchDest !== "document";

  const userAgent = request.headers.get("user-agent") ?? "";
  // /settings is exempt too (2026-08-31) — it's where a desktop visitor
  // generates the personal access token the Chrome extension authenticates
  // with (app/api/settings/api-token/route.ts). The extension itself is a
  // desktop-only tool (right-click a product image while browsing on
  // desktop Chrome), so unlike the rest of the app there genuinely is
  // something for a desktop visitor to do here — this doesn't reopen
  // dashboard/library/create/credits, which stay gated.
  const isExemptFromDeviceGate =
    isSubResourceRequest ||
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/settings");

  if (!isMobileUserAgent(userAgent) && !isExemptFromDeviceGate) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

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
