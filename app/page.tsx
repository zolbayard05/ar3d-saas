import { headers } from "next/headers";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { DesktopLanding } from "@/components/DesktopLanding";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";

// CLAUDE.md rule 40: one job (understand + go to /login in ~3s), reusing
// the login page's exact shell/button-width convention and the feed's
// exact wordmark markup (HomeFeed.tsx) rather than inventing variants.
// CTA goes to /login, not a public feed — /dashboard and /models stay
// auth-gated (proxy.ts PROTECTED_PREFIXES); a public showcase or public
// /models/[id] is a separate, later decision, not this screen's job.
//
// Desktop branch (2026-08-29) — lib/supabase/proxy.ts's device gate
// redirects every non-mobile-UA request for any other route to "/", so
// this is the ONE place a desktop visitor ever lands. Mobile's own splash
// below is untouched — same JSX it always was.
export default async function Home() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  if (!isMobileUserAgent(userAgent)) return <DesktopLanding />;

  return (
    <main className="flex min-h-dvh flex-col bg-bg p-6">
      <p className="text-body font-semibold text-text">Realify</p>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="flex max-w-xs flex-col gap-4">
          <h1 className="text-display font-semibold text-text">
            Зургаа өрөөндөө байрлуулж болох зүйл болгоорой.
          </h1>
          <p className="text-body text-text-muted">
            Зураг ав, 3D model үүсгэ, AR-аар харах — бүгд утаснаасаа шууд.
          </p>
        </div>

        <Link href="/login" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full max-w-xs" })}>
          Эхлэх
        </Link>
      </div>
    </main>
  );
}
