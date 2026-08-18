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

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  return { status, error, sendMagicLink, signOut };
}
