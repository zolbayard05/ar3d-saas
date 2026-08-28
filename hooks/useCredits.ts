"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCredits(
  userId: string,
  initialCredits: number | null = null,
) {
  const [credits, setCredits] = useState<number | null>(initialCredits);
  const [loading, setLoading] = useState(initialCredits === null && !!userId);

  useEffect(() => {
    // Sidebar.tsx calls this with "" for a signed-out visitor (rules of
    // hooks means it can't skip the call itself) — no real user to query
    // or subscribe for, so skip both rather than firing a request/realtime
    // channel for an id that can't match any row. No setState needed here:
    // the useState initializers above already resolve to
    // credits=initialCredits (null), loading=false for a falsy userId on
    // first render, which is the only time this ever matters in practice —
    // Sidebar's userId comes from a server-rendered value that doesn't
    // change client-side without a full navigation.
    if (!userId) return;

    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setCredits(data?.credits ?? null);
          setLoading(false);
        }
      });

    // Sidebar.tsx and LibraryFeed.tsx/CaptureChoice.tsx now both call this
    // for the same userId on the same page at once (2026-08-29) — reusing
    // the old bare `profile-credits-${userId}` channel name across two
    // simultaneous callers throws "cannot add postgres_changes callbacks...
    // after subscribe()" (caught live: crashed the whole page render,
    // Chrome showing "This page couldn't load"), since Supabase's realtime
    // client keys channels by topic name and only lets ONE subscriber
    // register listeners on a given topic before it's subscribed. A random
    // suffix, generated fresh each time this effect runs (only used inside
    // this same effect, so it doesn't need to be stable across renders —
    // no ref/state needed for it), gives every caller its own channel.
    const channel = supabase
      .channel(`profile-credits-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new as { credits?: number }).credits;
          if (typeof next === "number") setCredits(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { credits, loading };
}
