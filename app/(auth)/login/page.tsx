"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { status, error, sendMagicLink, signInWithPassword } = useAuth();
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
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            We&apos;ll email you a magic link — no password needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <p className="text-body text-text">
              Check <span className="font-medium">{email}</span> for a sign-in link.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={status === "error" ? (error ?? "Something went wrong") : undefined}
              />
              <Button type="submit" loading={status === "sending"}>
                Send magic link
              </Button>
            </form>
          )}
          {process.env.NODE_ENV === "development" && (
            <form onSubmit={handlePasswordSubmit} className="mt-6 flex flex-col gap-4 border-t border-border pt-6">
              <p className="text-caption text-text-muted">
                Dev-only password sign-in — bypasses email rate limits. Never available in production.
              </p>
              <Input
                type="password"
                label="Password"
                placeholder="dev password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button type="submit" variant="secondary" loading={status === "sending"}>
                Sign in with password (dev only)
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
