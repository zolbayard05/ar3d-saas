"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type AuthStatus = "idle" | "sending" | "error";

export function useAuth() {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // signInWithOAuth navigates the browser itself (window.location.assign)
  // once it gets a provider URL back — there's no local success/error state
  // to resolve to the way email sign-in has, since the next thing that
  // happens is the tab leaving this page entirely for Google's consent
  // screen. redirectTo reuses /auth/confirm — that route already handles a
  // PKCE `code` param (see app/auth/confirm/route.ts), which is exactly
  // what Supabase's OAuth callback sends; no separate callback route needed.
  const signInWithGoogle = useCallback(async (next?: string) => {
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: next
          ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`
          : `${window.location.origin}/auth/confirm`,
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
    }
  }, []);

  /**
   * One field, one button, handles both log in and sign up — matching the
   * reference screen's single "Continue" action rather than making the
   * user pick which one they're doing. Email confirmation is disabled on
   * this project (product decision, set in the Supabase dashboard under
   * Authentication → Providers → Email — not something this codebase
   * controls), so signUp returns an active session immediately instead of
   * requiring a confirmation-email round trip.
   *
   * Ordering matters and both branches were verified live against this
   * project's real (confirmation-disabled) config, not assumed:
   * 1. Try signInWithPassword first — optimizes for the common case (an
   *    existing user signing back in).
   * 2. On failure, try signUp. With confirmation disabled, calling signUp
   *    on an email that's ALREADY registered returns a real, explicit
   *    error — `code: "user_already_exists"` — rather than Supabase's
   *    masked "identities: []" anti-enumeration response (that masking is
   *    specifically a confirmation-flow behavior, to stop an attacker
   *    telling accounts apart by whether a confirmation email arrives;
   *    with no such email in play here, there's nothing to protect by
   *    hiding it). That code is what tells "the original sign-in's
   *    password was just wrong" apart from every other signUp failure.
   */
  const signInOrSignUp = useCallback(
    async (email: string, password: string, next: string = "/dashboard") => {
      setStatus("sending");
      setError(null);

      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        router.push(next);
        router.refresh();
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });

      if (signUpError?.code === "user_already_exists") {
        setStatus("error");
        setError("Имэйл эсвэл нууц үг буруу байна.");
        return;
      }

      if (signUpError) {
        setStatus("error");
        setError(signUpError.message);
        return;
      }

      if (signUpData.session) {
        router.push(next);
        router.refresh();
        return;
      }

      // Defensive fallback, not the expected path — verified live that
      // confirmation-disabled signUp returns a session immediately. Only
      // reachable if that dashboard setting gets flipped back on later.
      setStatus("error");
      setError("Нэвтрэхээсээ өмнө бүртгэлээ баталгаажуулахын тулд имэйлээ шалгана уу.");
    },
    [router],
  );

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  // redirectTo reuses /auth/confirm the same way signInWithGoogle does —
  // Supabase's reset email links there with a `code` (or `token_hash`+
  // `type=recovery`) that route already knows how to exchange for a
  // session; `next` sends the browser on to /auth/reset-password once
  // that's done, where the user actually sets a new password.
  const sendPasswordReset = useCallback(async (email: string) => {
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset-password`,
    });

    if (resetError) {
      setStatus("error");
      setError(resetError.message);
      return false;
    }

    setStatus("idle");
    return true;
  }, []);

  // Only reachable via the reset-password link's own established session
  // (app/(auth)/reset-password/page.tsx) — updateUser() here just needs
  // that session to exist, not the old password.
  const updatePassword = useCallback(
    async (password: string) => {
      setStatus("sending");
      setError(null);

      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setStatus("error");
        setError(updateError.message);
        return false;
      }

      setStatus("idle");
      router.push("/dashboard");
      router.refresh();
      return true;
    },
    [router],
  );

  return { status, error, signInWithGoogle, signInOrSignUp, signOut, sendPasswordReset, updatePassword };
}
