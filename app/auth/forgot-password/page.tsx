"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";

// Same shell as login/page.tsx (icon, bold heading, single field + button)
// rather than a new layout — this is one more step of the same sign-in
// flow, not a different part of the app.
export default function ForgotPasswordPage() {
  const { status, error, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    if (await sendPasswordReset(email)) setSent(true);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="Realify" className="size-16 rounded-md" />
          <h1 className="text-center text-display font-semibold text-text">Reset password</h1>
        </div>

        {sent ? (
          // Same message regardless of whether the address is registered —
          // resetPasswordForEmail doesn't reveal that either way, and
          // neither should this.
          <p className="text-center text-body text-text-muted">
            If an account exists for {email}, a reset link is on its way — check your email.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
            <Input
              type="email"
              aria-label="Email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" variant="primary" className="w-full" loading={status === "sending"}>
              Send reset link
            </Button>
            {status === "error" && <p className="text-small text-danger">{error}</p>}
          </form>
        )}

        <Link
          href="/login"
          className="text-small uppercase tracking-wide text-text-muted underline underline-offset-2 hover:text-text"
        >
          Back to log in
        </Link>
      </div>
    </main>
  );
}
