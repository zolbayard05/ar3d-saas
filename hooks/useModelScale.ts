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
 */
export function useModelScale(modelId: string, initialScale: number) {
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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        void createClient().from("models").update({ scale: next }).eq("id", modelId);
      }, PERSIST_DEBOUNCE_MS);
    },
    [modelId],
  );

  return [scale, setScalePersisted] as const;
}
