"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type MagicLinkStatus = "idle" | "sending" | "sent" | "error";

export function useAuth() {
  const router = useRouter();
  const [status, setStatus] = useState<MagicLinkStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const sendMagicLink = useCallback(async (email: string) => {
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }

    setStatus("sent");
  }, []);

  // signInWithOAuth navigates the browser itself (window.location.assign)
  // once it gets a provider URL back — there's no local success/error state
  // to resolve to the way email sign-in has, since the next thing that
  // happens is the tab leaving this page entirely for Google's consent
  // screen. redirectTo reuses /auth/confirm — that route already handles a
  // PKCE `code` param (see app/auth/confirm/route.ts), which is exactly
  // what Supabase's OAuth callback sends; no separate callback route needed.
  const signInWithGoogle = useCallback(async () => {
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
    }
  }, []);

  // Dev-only escape hatch: Supabase's free-tier email rate limit blocks
  // magic-link testing (not our bug — a platform limit), so local testing
  // needs a path that doesn't send email at all. Gated on NODE_ENV, which
  // Next.js inlines at build time — `next build`/`next start` compile this
  // branch to `false` and dead-code-eliminate it, so it cannot ship, not
  // just "be hidden in the UI".
  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      if (process.env.NODE_ENV !== "development") return;

      setStatus("sending");
      setError(null);

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setStatus("error");
        setError(signInError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    },
    [router],
  );

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  return { status, error, sendMagicLink, signInWithGoogle, signInWithPassword, signOut };
}
