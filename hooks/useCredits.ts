"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCredits(userId: string) {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    const channel = supabase
      .channel(`profile-credits-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
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
