"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";

// CLAUDE.md rule 40: no Card wrapper, no heading/description — every other
// post-redesign screen (feed, library, capture, confirm) is bare elements
// directly on the near-black page background, not panel chrome, and this
// page was asked for nothing beyond the three things below.
export default function LoginPage() {
  const { status, error, sendMagicLink, signInWithGoogle, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email) void sendMagicLink(email);
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email && password) void signInWithPassword(email, password);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-xs flex-col gap-4">
        {/* Primary: white fill/dark text, the one primary-button convention
            used everywhere else in the app. */}
        <Button
          type="button"
          variant="primary"
          className="w-full"
          loading={status === "sending"}
          onClick={() => void signInWithGoogle()}
        >
          Continue with Google
        </Button>

        {status === "error" && <p className="text-small text-danger">{error}</p>}

        <div className="flex items-center gap-3 text-small uppercase tracking-wide text-text-muted">
          <div className="h-px flex-1 bg-border-subtle" />
          Or
          <div className="h-px flex-1 bg-border-subtle" />
        </div>

        {/* Secondary: email + magic link, the outline-style Button variant. */}
        {status === "sent" ? (
          <p className="text-small text-text-muted">
            Check <span className="text-text">{email}</span> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              aria-label="Email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit" variant="secondary" className="w-full" loading={status === "sending"}>
              Send magic link
            </Button>
          </form>
        )}

        {/* Rule unchanged: NODE_ENV is inlined at build time, so this branch
            is dead-code-eliminated from every production build, not just
            hidden in the UI — see hooks/useAuth.ts's signInWithPassword. */}
        {process.env.NODE_ENV === "development" && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            <Input
              type="password"
              aria-label="Dev password"
              placeholder="dev password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" variant="secondary" className="w-full" loading={status === "sending"}>
              Sign in with password (dev only)
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
