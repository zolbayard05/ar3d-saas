"use client";

import { ModelCard } from "@/components/ModelCard";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface MasonryGridProps {
  models: ModelRow[];
  onRetry: (model: ModelRow) => void;
}

// CLAUDE.md rule 40 — the one masonry layout every screen reuses (dashboard
// feed, library). Two explicit flex-1 columns, not CSS `columns-2`:
// multi-column layout doesn't guarantee equal rendered column widths (a
// real, confirmed browser quirk). Cards alternate into left/right by index.
// Deliberately owns only the grid itself — 8px gutters (gap-2) and 8px
// side insets (px-2), matching rule 37 exactly — not the page's own scroll
// container or bottom padding, so callers can put other content (a header,
// a credits line, footer links) above or below it inside their own single
// scrollable region.
export function MasonryGrid({ models, onRetry }: MasonryGridProps) {
  return (
    <div className="flex gap-2 px-2">
      {[0, 1].map((col) => (
        <div key={col} className="flex flex-1 flex-col gap-2">
          {models
            .filter((_, i) => i % 2 === col)
            .map((model) => (
              <ModelCard key={model.id} initialModel={model} onRetry={onRetry} />
            ))}
        </div>
      ))}
    </div>
  );
}
