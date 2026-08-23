"use client";

import { ModelCard } from "@/components/ModelCard";
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
// Column assignment is a stable hash of the model's own id, NOT its index
// in `models`. HomeFeed's handleRetry prepends a new row to the front of
// that array on every retry — with index-parity assignment (`i % 2`), that
// shifts every *existing* model's index by one, flipping every card in the
// feed to the opposite column on every single retry (a card that was in the
// left column jumps to the right, and vice versa, for the entire feed, not
// just the new row). Hashing the id instead means a given model always
// renders in the same column regardless of what gets inserted or removed
// elsewhere in the list.
function columnForId(id: string): 0 | 1 {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) | 0;
  return (hash & 1) as 0 | 1;
}

export function MasonryGrid({ models, onRetry, onDelete }: MasonryGridProps) {
  return (
    <div className="flex gap-2 px-2">
      {[0, 1].map((col) => (
        <div key={col} className="flex flex-1 flex-col gap-2">
          {models
            .filter((model) => columnForId(model.id) === col)
            .map((model) => (
              <ModelCard key={model.id} initialModel={model} onRetry={onRetry} onDelete={onDelete} />
            ))}
        </div>
      ))}
    </div>
  );
}
