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
 *
 * `live` (2026-08-29, default true — ModelDetail's existing single-model
 * usage is completely unchanged) lets a caller skip opening a channel at
 * all. Added after a reproduced mobile perf bug: HomeFeed/LibraryFeed's
 * initial queries only ever return terminal rows (status ready/failed —
 * both feed pages filter to exactly that), which can never receive another
 * UPDATE, yet every ModelCard was opening its own Realtime WebSocket
 * channel regardless. On a library with a few dozen models that's a few
 * dozen redundant channels all opened at feed-mount time — real,
 * measured-plausible main-thread/connection overhead, and the likely cause
 * of the "images load slowly, scroll stutters, nav stops responding"
 * cluster reported on mobile. ModelCard now passes `live` only for a
 * genuinely pending/processing card (rare, transient, at most a couple at
 * once) instead of unconditionally.
 */
export function useModelRealtime(
  modelId: string,
  initialModel?: ModelRow,
  options?: { live?: boolean },
) {
  const [model, setModel] = useState<ModelRow | undefined>(initialModel);
  const live = options?.live ?? true;

  useEffect(() => {
    if (!live) return;

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
  }, [modelId, live]);

  return model;
}
