"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PERSIST_DEBOUNCE_MS = 400;

/**
 * Rule 22: AI meshes have no real-world scale, so this persists per-model.
 * Writes go straight from the browser's own session client — `scale` is one
 * of the two columns migration 0004 actually grants `authenticated` UPDATE
 * on (the other is `title`), so this doesn't need a server route the way
 * status/glb_url/usdz_url/credits do (rule 19).
 *
 * `persist` is false for a non-owner viewer (anonymous via a shared link, or
 * a signed-in visitor looking at someone else's model per migration 0011's
 * public select-ready policy) — the row's owner-update RLS policy would
 * reject the write anyway (auth.uid() = user_id doesn't match), so skipping
 * the call isn't just an optimization, it avoids a silent no-op write that'd
 * otherwise look like it succeeded. The control stays fully interactive
 * either way — adjusting scale to judge fit is the point even for a visitor
 * who can't save it.
 */
export function useModelScale(modelId: string, initialScale: number, persist: boolean) {
  const [scale, setScale] = useState(initialScale);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const setScalePersisted = useCallback(
    (next: number) => {
      setScale(next);
      if (!persist) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        void createClient().from("models").update({ scale: next }).eq("id", modelId);
      }, PERSIST_DEBOUNCE_MS);
    },
    [modelId, persist],
  );

  return [scale, setScalePersisted] as const;
}
