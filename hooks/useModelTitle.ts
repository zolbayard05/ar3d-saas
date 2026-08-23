"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * `title` is one of the two columns migration 0004 grants `authenticated`
 * UPDATE on directly (the other is `scale` — see hooks/useModelScale.ts),
 * so this writes straight from the browser's own session client, no server
 * route needed. Unlike scale (a continuous drag, debounced while moving), a
 * name edit commits once — on blur/Enter, not per keystroke — so `setTitle`
 * only updates local state (for the input to be typeable) and `commitTitle`
 * is a separate, explicit persist call.
 */
export function useModelTitle(modelId: string, initialTitle: string | null) {
  const [title, setTitle] = useState(initialTitle ?? "");

  const commitTitle = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      setTitle(trimmed);
      void createClient()
        .from("models")
        .update({ title: trimmed || null })
        .eq("id", modelId);
    },
    [modelId],
  );

  return { title, setTitle, commitTitle };
}
