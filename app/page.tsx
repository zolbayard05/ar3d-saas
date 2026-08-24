import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

// CLAUDE.md rule 40: one job (understand + go to /login in ~3s), reusing
// the login page's exact shell/button-width convention and the feed's
// exact wordmark markup (HomeFeed.tsx) rather than inventing variants.
// CTA goes to /login, not a public feed — /dashboard and /models stay
// auth-gated (proxy.ts PROTECTED_PREFIXES); a public showcase or public
// /models/[id] is a separate, later decision, not this screen's job.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-bg p-6">
      <p className="text-body font-semibold text-text">Realify</p>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="flex max-w-xs flex-col gap-4">
          <h1 className="text-display font-semibold text-text">
            Turn a photo into something you can place in your room.
          </h1>
          <p className="text-body text-text-muted">
            Snap a photo, get a 3D model, view it in AR — right from your phone.
          </p>
        </div>

        <Link href="/login" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full max-w-xs" })}>
          Get started
        </Link>
      </div>
    </main>
  );
}
