"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PERSIST_DEBOUNCE_MS = 400;

/**
 * Rule 22: AI meshes have no real-world scale, so this persists per-model.
 *
 * Used to write `scale` straight from the browser's own session client
 * (migration 0004 grants `authenticated` UPDATE on that column) — safe for
 * the DB value alone, but the DB value alone never did anything: the
 * on-page/AR viewer's `scale` attribute is a no-op in the installed
 * @google/model-viewer version (lib/glbScale.ts's header), so a slider drag
 * changed a number nobody read. Making it real means re-baking the actual
 * GLB, which needs R2 + a `glb_url` write (both service-role-only, rule
 * 34) — a browser client can't do that, hence the POST to a route instead
 * of a direct table update. ModelDetail's useModelRealtime subscription
 * picks up the resulting `scale`/`glb_url` change and reloads the viewer;
 * this hook doesn't need to touch either itself.
 *
 * `persist` is false for a non-owner viewer (anonymous via a shared link, or
 * a signed-in visitor looking at someone else's model per migration 0011's
 * public select-ready policy) — the route's own ownership check would
 * reject the write anyway, so skipping the call isn't just an optimization,
 * it avoids a request that'd only ever come back 404. The control stays
 * fully interactive either way — adjusting scale to judge fit is the point
 * even for a visitor who can't save it.
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
        void fetch("/api/models/rescale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: modelId, scale: next }),
        });
      }, PERSIST_DEBOUNCE_MS);
    },
    [modelId, persist],
  );

  return [scale, setScalePersisted] as const;
}
