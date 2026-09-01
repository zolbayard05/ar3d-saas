"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/GoogleIcon";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";

// New design direction (2026-08-24) — see styles/tokens.css's radius
// comment. Layout/hierarchy taken from the user's reference screen (mark,
// bold heading, email + password, Google below); background and the
// primary button's color are explicitly unchanged per that same
// conversation. Magic link is gone — replaced with a real email+password
// flow (useAuth's signInOrSignUp) rather than brought back, since the
// underlying need ("type an email, get in") is now served by that instead.
export default function LoginPage() {
  const { status, error, signInWithGoogle, signInOrSignUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Read directly from the URL inside the handlers (not at render time,
  // where `window` isn't available during this client component's SSR
  // pass) rather than useSearchParams(), which would require its own
  // Suspense boundary. Set by proxy.ts's own redirect-to-login (protected
  // routes) or by app/(app)/settings/page.tsx (?next=/settings), so a
  // desktop visitor who came here specifically to reach Settings lands
  // back there instead of useAuth's default /dashboard.
  function getNext(): string | undefined {
    return new URLSearchParams(window.location.search).get("next") || undefined;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email && password) void signInOrSignUp(email, password, getNext());
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="Realify" className="size-16 rounded-md" />
          <h1 className="text-center text-display font-semibold text-text">Нэвтрэх эсвэл бүртгүүлэх</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
          <Input
            type="email"
            aria-label="Имэйл"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            type="password"
            aria-label="Нууц үг"
            placeholder="Нууц үг"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" variant="primary" className="w-full" loading={status === "sending"}>
            Үргэлжлүүлэх
          </Button>
          <Link
            href="/auth/forgot-password"
            className="text-center text-small text-text-muted underline underline-offset-2 hover:text-text"
          >
            Нууц үгээ мартсан уу?
          </Link>
        </form>

        <div className="flex w-full items-center gap-3 text-small uppercase tracking-wide text-text-muted">
          <div className="h-px flex-1 bg-border-subtle" />
          Эсвэл
          <div className="h-px flex-1 bg-border-subtle" />
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          loading={status === "sending"}
          onClick={() => void signInWithGoogle(getNext())}
        >
          <GoogleIcon className="size-5" />
          Google-ээр үргэлжлүүлэх
        </Button>

        {status === "error" && <p className="text-small text-danger">{error}</p>}
      </div>
    </main>
  );
}
