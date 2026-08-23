"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

/**
 * CLAUDE.md rule 14: client updates come from a Realtime subscription on the
 * model row, never polling. `initialModel` seeds state (typically fetched
 * server-side right after /api/generate's 202) so the UI isn't blank while
 * the subscription connects.
 */
export function useModelRealtime(modelId: string, initialModel?: ModelRow) {
  const [model, setModel] = useState<ModelRow | undefined>(initialModel);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`model-${modelId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "models", filter: `id=eq.${modelId}` },
        (payload) => setModel(payload.new as ModelRow),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [modelId]);

  return model;
}
