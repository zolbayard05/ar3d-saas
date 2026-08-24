"use client";

import { useMemo } from "react";
import { ModelCard } from "@/components/ModelCard";
import { estimateCardHeight } from "@/lib/models";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface MasonryGridProps {
  models: ModelRow[];
  onRetry: (model: ModelRow) => void;
  onDelete: (model: ModelRow) => void;
}

// CLAUDE.md rule 40 — the one masonry layout every screen reuses (dashboard
// feed, library). Two explicit flex-1 columns, not CSS `columns-2`:
// multi-column layout doesn't guarantee equal rendered column widths (a
// real, confirmed browser quirk). Deliberately owns only the grid itself —
// 8px gutters (gap-2) and 8px side insets (px-2), matching rule 37 exactly —
// not the page's own scroll container or bottom padding, so callers can put
// other content (a header, a credits line, footer links) above or below it
// inside their own single scrollable region.
//
// Column assignment: greedy shortest-column packing using each card's
// EXPECTED height (lib/models.ts's estimateCardHeight, from the source
// photo's stored pixel aspect ratio) — not a coin-flip hash. A hash gives
// each card a *stable* column, but stable isn't the same as *balanced*: two
// tall cards can land in the same column by hash chance while the other
// column gets three short ones, which is exactly the "right column runs out
// early" symptom. Packing by expected height fixes the balance without
// giving up stability, as long as the PACKING ORDER itself never changes
// for existing cards — see assignColumns below for how that's kept true
// even though HomeFeed's handleRetry prepends new rows to the front of
// `models`.
function assignColumns(models: ModelRow[]): Map<string, 0 | 1> {
  // Sorted oldest-first, not in `models`' own (display, newest-first) order.
  // A model's created_at never changes once set, so this ordering is stable
  // regardless of what handleRetry prepends to the front of the display
  // array — a new (always-newest) row only ever adds ONE new packing
  // decision at the very end of this sequence, never touching where any
  // existing card already landed. That's the same stability guarantee the
  // old id-hash approach had, just derived from real ordering instead of
  // being independent of order entirely.
  const oldestFirst = [...models].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const columnHeights: [number, number] = [0, 0];
  const assignment = new Map<string, 0 | 1>();

  for (const model of oldestFirst) {
    const col: 0 | 1 = columnHeights[0] <= columnHeights[1] ? 0 : 1;
    assignment.set(model.id, col);
    columnHeights[col] += estimateCardHeight(model);
  }

  return assignment;
}

export function MasonryGrid({ models, onRetry, onDelete }: MasonryGridProps) {
  const columnOf = useMemo(() => assignColumns(models), [models]);

  return (
    <div className="flex gap-2 px-2">
      {([0, 1] as const).map((col) => (
        <div key={col} className="flex flex-1 flex-col gap-2">
          {models
            .filter((model) => columnOf.get(model.id) === col)
            .map((model) => (
              <ModelCard key={model.id} initialModel={model} onRetry={onRetry} onDelete={onDelete} />
            ))}
        </div>
      ))}
    </div>
  );
}
